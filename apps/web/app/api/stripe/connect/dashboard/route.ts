import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isMockStripeAccount, paymentsMode, stripe } from "@/lib/payments";

export async function GET() {
  const user = await requireUser(["COACH"]);
  const profile = await prisma.coachProfile.findUnique({ where: { userId: user.id } });
  if (paymentsMode() !== "stripe" || !profile?.stripeAccountId || isMockStripeAccount(profile.stripeAccountId)) return Response.redirect(new URL("/coach/billing?stripe=not-connected", env().APP_URL), 303);
  const link = await stripe().accounts.createLoginLink(profile.stripeAccountId);
  return Response.redirect(link.url, 303);
}
