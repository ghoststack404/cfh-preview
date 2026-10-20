import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isMockStripeAccount, paymentsMode, stripe } from "@/lib/payments";
import { assertSameOrigin } from "@/lib/security";

const supportedCountries = new Set(["MX", "US", "CA", "BR", "GB", "ES", "FR", "DE", "IT", "PT"]);

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

export async function POST(req: Request) {
  try {
    await assertSameOrigin();
    const origin = getDynamicOrigin(req);
    const user = await requireUser(["COACH"]);
    const full = await prisma.user.findUnique({ where: { id: user.id }, include: { coachProfile: true } });
    if (!full?.coachProfile) throw new Error("NOT_FOUND");
    if (paymentsMode() === "mock") {
      await prisma.coachProfile.update({ where: { userId: user.id }, data: { stripeAccountId: full.coachProfile.stripeAccountId ?? `acct_mock_${user.id}`, stripeChargesEnabled: true } });
      return ok({ url: `${origin}/coach/billing?stripe=mock` });
    }
    let accountId = full.coachProfile.stripeAccountId;
    if (!accountId || isMockStripeAccount(accountId)) {
      const country = full.countryCode && supportedCountries.has(full.countryCode) ? full.countryCode : "MX";
      const account = await stripe().accounts.create({
        type: "express",
        country,
        email: full.email,
        business_type: "individual",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { userId: full.id, platform: "coaching-from-home" }
      });
      accountId = account.id;
      await prisma.coachProfile.update({ where: { userId: user.id }, data: { stripeAccountId: account.id, stripeChargesEnabled: false } });
      await audit({ actorId: user.id, action: "STRIPE_ACCOUNT_CREATED", entityType: "CoachProfile", entityId: full.coachProfile.id, metadata: { accountId: account.id } });
    }
    const link = await stripe().accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: env().STRIPE_CONNECT_RETURN_URL || `${origin}/api/stripe/connect/return`,
      refresh_url: env().STRIPE_CONNECT_REFRESH_URL || `${origin}/coach/billing?stripe=refresh`
    });
    return ok({ url: link.url });
  } catch (error) { return handleRouteError(error); }
}
