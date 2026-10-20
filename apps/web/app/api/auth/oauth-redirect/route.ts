import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getBaseUrl(request?: Request): string {
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("0.0.0.0") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "");
  }
  if (request) {
    const fHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const fProto = request.headers.get("x-forwarded-proto") || "https";
    if (fHost && !fHost.includes("0.0.0.0") && !fHost.includes("127.0.0.1")) {
      return `${fProto}://${fHost}`.replace(/\/$/, "");
    }
  }
  return "https://coachingfromhome.com.mx";
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  const { searchParams } = new URL(request.url);
  const flow = searchParams.get("flow") || "login";
  const requestedRole = (searchParams.get("role") || "STUDENT").toUpperCase();

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/?auth=login&error=oauth_failed", baseUrl));
  }

  const email = session.user.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { coachProfile: true },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/?auth=login&error=user_not_found", baseUrl));
  }

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const locPrefix = locale ? `/${locale}` : "";

  // Sincronizar la sesión interna de CFH
  try {
    await createSession(user.id);
  } catch (e) {
    console.warn("[oauth-redirect] Error creando sesión interna:", e);
  }

  // Si solicitó ser COACH y su rol en la BD no es COACH, asignarle el rol COACH
  if (requestedRole === "COACH" && user.role !== "COACH") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "COACH" },
    });
    user.role = "COACH";
  }

  const isOnboardingCompleted =
    user.role === "COACH"
      ? Boolean(user.coachProfile)
      : Boolean(user.onboardingCompletedAt || (user.interests && Array.isArray(user.interests) && (user.interests as any[]).length > 0));

  // Redirección inteligente:
  let dest = `${locPrefix}/`;
  if (!isOnboardingCompleted) {
    dest = user.role === "COACH" ? `${locPrefix}/coach/onboarding` : `${locPrefix}/student/onboarding`;
  } else {
    dest = user.role === "COACH" ? `${locPrefix}/coach/dashboard` : `${locPrefix}/dashboard`;
  }

  const response = NextResponse.redirect(new URL(dest, baseUrl));

  // Sincronizar cookies de rol y onboarding en cookieStore y en la respuesta HTTP para el cliente
  cookieStore.set("cfh_active_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  cookieStore.set("cfh_user_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  cookieStore.set("cfh_onboarding_completed", String(isOnboardingCompleted), { path: "/", maxAge: 60 * 60 * 24 * 30 });

  response.cookies.set("cfh_active_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("cfh_user_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("cfh_onboarding_completed", String(isOnboardingCompleted), { path: "/", maxAge: 60 * 60 * 24 * 30 });

  return response;
}
