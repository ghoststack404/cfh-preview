import { createSession, verifyPassword } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { loginSchema } from "@/lib/validation";
import { cookies } from "next/headers";
import { checkAndAutoReactivateUser, getSuspensionDetails } from "@/lib/communityStrikes";

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const input = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        coachProfile: { select: { id: true } },
      },
    });

    if (!user) {
      return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    if (!user.passwordHash) {
      return Response.json(
        { error: "Esta cuenta fue registrada con Google. Por favor, inicia sesión con el botón 'Continuar con Google'." },
        { status: 400 }
      );
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    if (user.status === "SUSPENDED") {
      const check = await checkAndAutoReactivateUser(user.id);
      if (check.isSuspended) {
        const suspensionDetails = await getSuspensionDetails(user.id);
        const dateStr = check.suspendedUntil
          ? check.suspendedUntil.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        return Response.json(
          {
            error: `Tu cuenta está temporalmente suspendida por incumplimiento de las normas de la comunidad. Podrás ingresar nuevamente en ${check.remainingText}${dateStr ? ` (el ${dateStr})` : ""}.`,
            isSuspended: true,
            suspensionDetails,
          },
          { status: 403 }
        );
      }
    } else if (user.status !== "ACTIVE") {
      return Response.json({ error: "Esta cuenta no está activa. Contacta a soporte." }, { status: 403 });
    }

    await createSession(user.id);

    const isOnboardingCompleted =
      user.role === "COACH"
        ? Boolean(user.coachProfile)
        : Boolean(user.onboardingCompletedAt || (user.interests && Array.isArray(user.interests) && (user.interests as any[]).length > 0));

    const cookieStore = await cookies();
    cookieStore.set("cfh_active_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("cfh_user_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("cfh_onboarding_completed", String(isOnboardingCompleted), { path: "/", maxAge: 60 * 60 * 24 * 30 });

    await audit({ actorId: user.id, action: "USER_LOGGED_IN", entityType: "User", entityId: user.id });
    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isOnboardingCompleted,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
