import { currentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isMockStripeAccount, paymentsMode, retrieveConnectedAccount } from "@/lib/payments";

function getDynamicOrigin(req: Request): string {
  const originHeader = req.headers.get("origin");
  if (originHeader) return originHeader;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return env().APP_URL;
}

export async function GET(req: Request) {
  const origin = getDynamicOrigin(req);
  try {
    const user = await currentUser();
    if (!user) {
      return Response.redirect(new URL("/coach/billing?stripe=error&msg=unauthorized", origin), 303);
    }

    let isCoach = user.role === "COACH" || Boolean(user.coachProfile);
    try {
      const store = await cookies();
      const activeRole = store.get("cfh_active_role")?.value;
      if (activeRole === "COACH") {
        isCoach = true;
      }
    } catch {
      // In contexts without cookies
    }

    if (!isCoach) {
      return Response.redirect(new URL("/coach/billing?stripe=error&msg=forbidden", origin), 303);
    }

    const profile = await prisma.coachProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      return Response.redirect(new URL("/coach/billing?stripe=error&msg=profile_not_found", origin), 303);
    }

    if (paymentsMode() === "stripe" && profile.stripeAccountId && !isMockStripeAccount(profile.stripeAccountId)) {
      const status = await retrieveConnectedAccount(profile.stripeAccountId);
      await prisma.coachProfile.update({
        where: { userId: user.id },
        data: { stripeChargesEnabled: Boolean(status.chargesEnabled && status.payoutsEnabled) }
      });
    } else if (paymentsMode() === "mock") {
      await prisma.coachProfile.update({
        where: { userId: user.id },
        data: { stripeChargesEnabled: true }
      });
    }

    return Response.redirect(new URL("/coach/billing?stripe=return", origin), 303);
  } catch (err: any) {
    console.error("Error en Stripe Connect return route:", err);
    const msg = encodeURIComponent(err?.message || "error_procesando_retorno");
    return Response.redirect(new URL(`/coach/billing?stripe=error&msg=${msg}`, origin), 303);
  }
}
