import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  region: true,
  countryCode: true,
  locale: true,
  avatarUrl: true,
  interests: true,
  goals: true,
  onboardingCompletedAt: true,
  secondChanceUsed: true,
  coachProfile: {
    select: {
      id: true,
      slug: true,
      approvalStatus: true,
      level: true,
      headline: true,
      hourlyRateCents: true,
      photoUrl: true,
    },
  },
} as const;

function formatUserResponse(user: any, activeRoleCookie?: string) {
  let activeRole = user.role;
  if (activeRoleCookie && (activeRoleCookie === "COACH" || activeRoleCookie === "STUDENT")) {
    activeRole = activeRoleCookie;
  }

  const effectiveRole = activeRole || user.role;
  const isOnboardingCompleted =
    effectiveRole === "COACH"
      ? Boolean(user.coachProfile)
      : Boolean(user.onboardingCompletedAt || (user.interests && Array.isArray(user.interests) && (user.interests as any[]).length > 0));

  const userAvatar = user.avatarUrl || user.image || null;
  const coachPhoto = user.coachProfile?.photoUrl || null;

  return {
    ...user,
    role: user.role,
    activeRole,
    isOnboardingCompleted,
    avatarUrl: userAvatar,
    coachPhotoUrl: coachPhoto,
  };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;

    // 1. Intentar con sesión custom
    const customUser = await currentUser();
    if (customUser) {
      const userRes = formatUserResponse(customUser, activeRoleCookie);
      // Sincronizar cookies de guard
      cookieStore.set("cfh_user_role", customUser.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_onboarding_completed", String(userRes.isOnboardingCompleted), { path: "/", maxAge: 60 * 60 * 24 * 30 });

      console.log("[/api/auth/me] Step 1 (Custom Session) success for user:", customUser.email);
      return NextResponse.json(
        { authenticated: true, user: userRes },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // 2. Intentar con NextAuth v5 auth()
    try {
      const session = await auth();
      if (session?.user?.id || session?.user?.email) {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              ...(session.user.id ? [{ id: session.user.id }] : []),
              ...(session.user.email ? [{ email: session.user.email }] : []),
            ],
          },
          select: publicUserSelect,
        });
        if (user && user.status === "ACTIVE") {
          const userRes = formatUserResponse(user, activeRoleCookie);
          cookieStore.set("cfh_user_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
          cookieStore.set("cfh_onboarding_completed", String(userRes.isOnboardingCompleted), { path: "/", maxAge: 60 * 60 * 24 * 30 });

          console.log("[/api/auth/me] Step 2 (NextAuth) success for user:", user.email);
          return NextResponse.json(
            { authenticated: true, user: userRes },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
          );
        }
      }
    } catch (authErr) {
      console.error("[/api/auth/me] Error en auth():", authErr);
    }

    // 3. Intentar decodificar JWT directamente de cookies
    try {
      const token =
        cookieStore.get("authjs.session-token")?.value ||
        cookieStore.get("__Secure-authjs.session-token")?.value ||
        cookieStore.get("next-auth.session-token")?.value ||
        cookieStore.get("__Secure-next-auth.session-token")?.value;

      if (token) {
        const isSecure = Boolean(
          cookieStore.get("__Secure-authjs.session-token") ||
          cookieStore.get("__Secure-next-auth.session-token")
        );
        const salt = isSecure
          ? cookieStore.get("__Secure-authjs.session-token")
            ? "__Secure-authjs.session-token"
            : "__Secure-next-auth.session-token"
          : cookieStore.get("authjs.session-token")
          ? "authjs.session-token"
          : "next-auth.session-token";

        const decoded = await decode({
          token,
          secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_development",
          salt,
        });

        if (decoded?.id || decoded?.sub || decoded?.email) {
          const userIdStr = (decoded.id || decoded.sub) as string;

          if (userIdStr) {
            const customSession = await prisma.session.findFirst({
              where: { userId: userIdStr },
              orderBy: { createdAt: 'desc' }
            });
            if (!customSession) {
              return NextResponse.json({ authenticated: false, user: null });
            }
            const sessionCreatedMs = customSession.createdAt.getTime();
            const tokenLoginMs = (decoded.loginTimestamp as number) || ((decoded.iat as number) * 1000);
            if (tokenLoginMs && tokenLoginMs < sessionCreatedMs - 5000) {
              return NextResponse.json({ authenticated: false, user: null });
            }
          }

          const user = await prisma.user.findFirst({
            where: {
              OR: [
                ...(decoded.id ? [{ id: decoded.id as string }] : []),
                ...(decoded.sub ? [{ id: decoded.sub as string }] : []),
                ...(decoded.email ? [{ email: decoded.email as string }] : []),
              ],
            },
            select: publicUserSelect,
          });
          if (user && user.status === "ACTIVE") {
            const userRes = formatUserResponse(user, activeRoleCookie);
            cookieStore.set("cfh_user_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
            cookieStore.set("cfh_onboarding_completed", String(userRes.isOnboardingCompleted), { path: "/", maxAge: 60 * 60 * 24 * 30 });

            console.log("[/api/auth/me] Step 3 (Fallback) success for user:", user.email);
            return NextResponse.json(
              { authenticated: true, user: userRes },
              { headers: { "Cache-Control": "no-store, max-age=0" } }
            );
          }
        }
      }
    } catch (jwtErr) {
      console.error("[/api/auth/me] Error decodificando JWT:", jwtErr);
    }

    console.log("[/api/auth/me] Returning authenticated: false");
    return NextResponse.json({ authenticated: false, user: null });
  } catch (error) {
    console.error("[/api/auth/me] Error general:", error);
    return NextResponse.json({ authenticated: false, user: null });
  }
}
