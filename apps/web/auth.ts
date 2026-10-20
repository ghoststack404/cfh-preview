if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { checkAndAutoReactivateUser } from "@/lib/communityStrikes"

const prisma = new PrismaClient()

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Credenciales incompletas")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) {
          throw new Error("Usuario no encontrado")
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          throw new Error("Contraseña incorrecta")
        }

        if (user.status === "SUSPENDED") {
          await checkAndAutoReactivateUser(user.id);
        } else if (user.status !== "ACTIVE") {
          throw new Error("Esta cuenta no está activa. Contacta a soporte.");
        }
        // Crear una sesión simulada en DB para sincronizar NextAuth JWTs entre dispositivos
        // Esto garantiza que sessionCreatedMs siempre se actualice, incluso si usan la página por defecto de NextAuth
        try {
          await prisma.session.deleteMany({ where: { userId: user.id } });
          await prisma.session.create({
            data: {
              userId: user.id,
              tokenHash: "nextauth_sync_" + Date.now().toString() + "_" + Math.random().toString(36).substring(7),
              expiresAt: new Date(Date.now() + 30 * 86400 * 1000)
            }
          });
        } catch (dbErr) {
          console.error("[authorize] Error syncing DB session:", dbErr);
        }

        return user
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (user?.id) {
        syncCoachSubscriptionOnLogin(user.id).catch((err) =>
          console.error("[signIn] Background Stripe sync error:", err)
        );
        
        // Ensure a DB session exists to prevent SessionConflict logouts
        try {
          await prisma.session.deleteMany({ where: { userId: user.id } });
          await prisma.session.create({
            data: {
              userId: user.id,
              tokenHash: "nextauth_sync_" + Date.now().toString() + "_" + Math.random().toString(36).substring(7),
              expiresAt: new Date(Date.now() + 30 * 86400 * 1000)
            }
          });
        } catch (dbErr) {
          console.error("[signIn] Error syncing DB session:", dbErr);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.picture = (user as any).image || (user as any).avatarUrl || null;
        token.loginTimestamp = Date.now();
      }
      
      if (token.id || token.sub) {
        const userId = ((token.id as string) || (token.sub as string));
        

        try {
          // Buscar la sesión más reciente en la DB
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, name: true, avatarUrl: true, status: true }

          });

          if (dbUser && dbUser.status !== "ACTIVE") {
            console.log("[JWT] User is suspended or inactive! Invalidating JWT.");
            return { error: "Suspended" };
          }

          // Desactivado SessionConflict para evitar desconexiones erróneas causadas por desincronización de reloj o entre NextAuth JWT y sesiones DB en cPanel
          /*
          const customSession = await prisma.session.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
          });

          if (!customSession) {
            console.log("[JWT] No custom session found for userId:", userId, "- invalidating JWT");
            // return { error: "SessionConflict" }; // Invalida el JWT asumiendo que se cerró sesión en otro lado
          }

          // Invalida JWTs de dispositivos viejos (aquellos emitidos antes de que se creara la sesión actual)
          const sessionCreatedMs = customSession.createdAt.getTime();
          const tokenLoginMs = (token.loginTimestamp as number) || ((token.iat as number) * 1000);
          
          console.log(`[JWT] Comparing for user ${userId}: tokenLoginMs=${tokenLoginMs}, sessionCreatedMs=${sessionCreatedMs}, diff=${sessionCreatedMs - tokenLoginMs}`);
          
          if (tokenLoginMs && tokenLoginMs < sessionCreatedMs - 5000) {
            console.log("[JWT] Token is too old compared to latest DB session! Invalidating JWT.");
            // return { error: "SessionConflict" }; // Invalida el JWT porque pertenece a un inicio de sesión anterior
          }
          */

          const studentPicture = (dbUser as any)?.image || dbUser?.avatarUrl || null;
          let coachPhoto: string | null = null;
          let coachDisplayName: string | null = null;
          
          if (dbUser) {
            const coachProfile = await prisma.coachProfile.findUnique({
              where: { userId },
              select: { photoUrl: true, displayName: true }
            });
            if (coachProfile) {
              coachPhoto = coachProfile.photoUrl || null;
              if (coachProfile.displayName) coachDisplayName = coachProfile.displayName;
            }
          }

          if (dbUser) {
            token.role = dbUser.role;
            token.name = dbUser.name;
            token.picture = studentPicture;
            token.avatarUrl = studentPicture;
            token.coachPhotoUrl = coachPhoto;
            token.coachName = coachDisplayName;
          }
        } catch (dbErr) {
          console.warn("[JWT] Database connection timeout, maintaining current session token:", dbErr);
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.error === "SessionConflict" || token.error === "Suspended") {
        (session as any).error = token.error;
        session.user = { id: "", email: "", emailVerified: null } as any; // Invalidar user
        return session;
      }

      if (session.user) {
        session.user.id = ((token.id as string) || (token.sub as string)) as string;
        (session.user as any).role = token.role;
        session.user.image = (token.picture as string) || null;
        (session.user as any).avatarUrl = (token.picture as string) || null;
        session.user.name = (token.name as string) || session.user.name;
        (session.user as any).coachPhotoUrl = (token.coachPhotoUrl as string) || null;
        (session.user as any).coachName = (token.coachName as string) || null;
      }
      return session
    },
  },
  pages: {
    signIn: "/?auth=login",
    error: "/?auth=login",
  }
})

/**
 * Webhook Desync Recovery (Sync-on-Login)
 * Reconciles Stripe subscription status when a coach signs in.
 */
export async function syncCoachSubscriptionOnLogin(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        coachProfile: true,
        coachSubscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
      },
    });

    if (!user || user.role !== "COACH") return;

    const currentSub = user.coachSubscriptions[0];
    if (!currentSub || !currentSub.stripeCustomerId) return;

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.trim() === "" || currentSub.stripeCustomerId.startsWith("cus_mock")) {
      return;
    }

    const { stripe } = await import("@/lib/payments");
    const stripeClient = stripe();

    // Query Stripe for the latest subscription of this customer
    const stripeSubs = await stripeClient.subscriptions.list({
      customer: currentSub.stripeCustomerId,
      status: "all",
      limit: 1,
    });

    const latestStripeSub = stripeSubs.data[0];
    if (!latestStripeSub) return;

    let newStatus: "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" | "INACTIVE" = "INACTIVE";
    let gracePeriodEndsAt = currentSub.gracePeriodEndsAt;

    if (latestStripeSub.status === "active") {
      newStatus = "ACTIVE";
      gracePeriodEndsAt = null;
    } else if (latestStripeSub.status === "past_due" || latestStripeSub.status === "unpaid") {
      newStatus = "PAST_DUE";
      if (!gracePeriodEndsAt) {
        gracePeriodEndsAt = new Date(Date.now() + 3 * 86400 * 1000); // 72h grace
      }
    } else if (latestStripeSub.status === "canceled") {
      newStatus = "CANCELED";
      gracePeriodEndsAt = null;
    } else if (latestStripeSub.status === "trialing") {
      newStatus = "TRIALING";
    }

    // Reconcile if DB state is desynced
    if (currentSub.status !== newStatus || currentSub.stripeSubscriptionId !== latestStripeSub.id) {
      await prisma.coachSubscription.update({
        where: { id: currentSub.id },
        data: {
          status: newStatus,
          stripeSubscriptionId: latestStripeSub.id,
          currentPeriodStart: new Date(((latestStripeSub as any).current_period_start || 0) * 1000),
          currentPeriodEnd: new Date(((latestStripeSub as any).current_period_end || 0) * 1000),
          cancelAtPeriodEnd: (latestStripeSub as any).cancel_at_period_end ?? false,
          gracePeriodEndsAt,
        },
      });

      // Update coach profile currentTier based on subscription status
      if (user.coachProfile) {
        if (newStatus === "ACTIVE" || (newStatus === "PAST_DUE" && gracePeriodEndsAt && gracePeriodEndsAt >= new Date())) {
          if (currentSub.plan?.tier) {
            await prisma.coachProfile.update({
              where: { id: user.coachProfile.id },
              data: { currentTier: currentSub.plan.tier },
            });
          }
        } else if (newStatus === "CANCELED" || (newStatus === "PAST_DUE" && gracePeriodEndsAt && gracePeriodEndsAt < new Date())) {
          await prisma.coachProfile.update({
            where: { id: user.coachProfile.id },
            data: { currentTier: "BASIC" },
          });
        }
      }
    }
  } catch (syncError) {
    console.error("[syncCoachSubscriptionOnLogin] Error syncing Stripe subscription on login:", syncError);
  }
}

