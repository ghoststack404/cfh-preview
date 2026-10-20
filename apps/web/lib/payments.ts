import Stripe from "stripe";
import { env, requireIntegration } from "@/lib/env";

let stripeClient: Stripe | undefined;

export function paymentsMode() { return env().PAYMENTS_MODE; }
export function isMockStripeAccount(accountId?: string | null) { return Boolean(accountId?.startsWith("acct_mock_")); }

export function stripe() {
  requireIntegration(["STRIPE_SECRET_KEY"], "Stripe");
  if (process.env.NODE_ENV !== "production") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { appInfo: { name: "Coaching From Home", version: "1.2.0" } });
  return stripeClient;
}

export function stripePriceForPlan(code: string) {
  const upper = (code || "").toUpperCase();
  if (upper === "CURSOS" || upper === "CURSOS_ONLY" || upper === "PLAN_CURSOS") {
    return process.env.STRIPE_CURSOS_PRICE_ID;
  }
  if (upper === "ELITE" || upper === "PLAN_ELITE") {
    return process.env.STRIPE_ELITE_PRICE_ID;
  }
  if (upper === "GOLD" || upper === "PLAN_GOLD") {
    return process.env.STRIPE_GOLD_PRICE_ID;
  }
  if (upper === "PLATINUM" || upper === "PLAN_PLATINUM") {
    return process.env.STRIPE_PLATINUM_PRICE_ID;
  }
  if (upper === "PRO") {
    return process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_ELITE_PRICE_ID;
  }
  return undefined;
}

export async function retrieveConnectedAccount(accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  return {
    id: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsDue: account.requirements?.currently_due ?? []
  };
}

export async function getOrCreateStripeCustomer(email: string, name?: string | null, userId?: string | null) {
  const stripeClient = stripe();
  const existing = await stripeClient.customers.list({
    email,
    limit: 1,
  });
  if (existing.data.length > 0 && existing.data[0]) {
    return existing.data[0].id;
  }
  const customer = await stripeClient.customers.create({
    email,
    name: name || undefined,
    metadata: userId ? { userId } : undefined,
  });
  return customer.id;
}
