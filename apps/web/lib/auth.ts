import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, requestContext, sha256 } from "@/lib/security";
import { checkAndAutoReactivateUser } from "@/lib/communityStrikes";

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
  coachProfile: {
    select: {
      id: true,
      slug: true,
      approvalStatus: true,
      displayName: true,
      level: true,
      headline: true,
      hourlyRateCents: true,
      photoUrl: true,
    }
  }
} as const;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  // Invalidar cualquier sesion anterior para que solo haya 1 activa a la vez
  await prisma.session.deleteMany({ where: { userId } });

  const token = randomToken(40);
  const { ipAddress, userAgent } = await requestContext();
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86_400_000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      ipAddress,
      userAgent,
      expiresAt
    }
  });
  const store = await cookies();
  store.set(env().SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(env().SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
    } catch (err) {
      console.warn("[destroySession] Error deleting session in DB:", err);
    }
  }
  
  // Limpiar cookie de sesión propia
  store.delete(env().SESSION_COOKIE_NAME);

  // Limpiar cookies asociadas a NextAuth / Auth.js
  const nextAuthCookies = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "next-auth.csrf-token",
    "authjs.callback-url",
    "next-auth.callback-url",
  ];

  for (const cookieName of nextAuthCookies) {
    store.delete(cookieName);
  }
}

export async function currentUser() {
  const store = await cookies();
  const token = store.get(env().SESSION_COOKIE_NAME)?.value;
  if (token) {

    try {
      const session = await prisma.session.findUnique({
        where: { tokenHash: sha256(token) },
        include: { user: { select: publicUserSelect } }
      });
      if (session && session.expiresAt && session.expiresAt > new Date()) {
        if (session.user.status === "ACTIVE") {
          return session.user;
        }
        if (session.user.status === "SUSPENDED") {
          const reactivate = await checkAndAutoReactivateUser(session.userId);
          if (!reactivate.isSuspended) {
            return { ...session.user, status: "ACTIVE" };
          } else {
            // El usuario sigue suspendido: retornar sus datos para mostrar el banner y countdown
            return { ...session.user, status: "SUSPENDED" };
          }

        }
      }
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
    } catch (err) {
      console.warn("[currentUser] Database connection error during session lookup:", err);
    }
  }

  // Respaldo para NextAuth v5
  try {
    const { auth } = await import("@/auth");
    const nextAuthSession = await auth();
    const userId = nextAuthSession?.user?.id;
    const userEmail = nextAuthSession?.user?.email;

    if (userId || userEmail) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            ...(userId ? [{ id: userId }] : []),
            ...(userEmail ? [{ email: userEmail }] : []),
          ]
        },
        select: publicUserSelect
      });
      if (user) {
        if (user.status === "ACTIVE") {
          return user;
        }
        if (user.status === "SUSPENDED") {
          const reactivate = await checkAndAutoReactivateUser(user.id);
          if (!reactivate.isSuspended) {
            return { ...user, status: "ACTIVE" };
          } else {
            return { ...user, status: "SUSPENDED" };
          }
        }
      }
    }
  } catch {
    // Silently continue
  }

  return null;
}

export async function requireUser(roles?: UserRole[]) {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (roles) {
    let effectiveRole = user.role;
    try {
      const store = await cookies();
      const activeRole = store.get("cfh_active_role")?.value as UserRole | undefined;
      if (activeRole === "COACH" || activeRole === "STUDENT" || activeRole === "ADMIN") {
        effectiveRole = activeRole;
      }
    } catch {
      // In contexts without cookies access
    }
    const matchesRole =
      roles.includes(user.role) ||
      roles.includes(effectiveRole) ||
      (roles.includes("COACH") && Boolean(user.coachProfile));

    if (!matchesRole) throw new Error("FORBIDDEN");
  }
  return user;
}

export async function requirePageUser(roles?: UserRole[]) {
  const user = await currentUser();
  if (!user) redirect("/?auth=login");
  const store = await cookies();
  const activeRole = store.get("cfh_active_role")?.value as UserRole | undefined;
  const effectiveRole = (activeRole === "COACH" || activeRole === "STUDENT") ? activeRole : user.role;
  if (roles && !roles.includes(effectiveRole)) {
    if (effectiveRole === "COACH") {
      redirect("/coach/dashboard");
    } else {
      redirect("/dashboard");
    }
  }
  return { ...user, activeRole: effectiveRole };
}
