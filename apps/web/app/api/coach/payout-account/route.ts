import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { paymentsMode, stripe, isMockStripeAccount } from "@/lib/payments";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
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
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
      }
    });

    if (!profile) {
      return NextResponse.json({ error: "COACH_PROFILE_NOT_FOUND" }, { status: 404 });
    }

    const isMock = paymentsMode() === "mock" || isMockStripeAccount(profile.stripeAccountId);

    if (isMock) {
      const isConnected = Boolean(profile.stripeChargesEnabled || profile.stripeAccountId);
      const externalAccounts = isConnected
        ? [
            {
              id: "ba_mock_1",
              object: "bank_account",
              bankName: "BBVA México (Mock)",
              last4: "4829",
              currency: "MXN",
              routingNumber: "012",
              status: "verified",
              defaultForCurrency: true
            }
          ]
        : [];

      return NextResponse.json({
        connected: isConnected,
        isMock: true,
        accountId: profile.stripeAccountId || (isConnected ? `acct_mock_${user.id}` : null),
        chargesEnabled: isConnected,
        payoutsEnabled: isConnected,
        detailsSubmitted: isConnected,
        externalAccounts,
        requirementsDue: isConnected ? [] : ["external_account", "tos_acceptance"],
        payoutSchedule: isConnected
          ? {
              interval: "daily",
              delayDays: 2
            }
          : null,
        dashboardUrl: isConnected ? "/coach/billing?stripe=mock-dashboard" : null,
        details: {
          chargesEnabled: isConnected,
          payoutsEnabled: isConnected,
          bankAccounts: externalAccounts,
          dashboardUrl: isConnected ? "/coach/billing?stripe=mock-dashboard" : null
        }
      });
    }

    // Real Stripe Mode
    if (!profile.stripeAccountId) {
      return NextResponse.json({
        connected: false,
        isMock: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        externalAccounts: [],
        requirementsDue: ["account_onboarding"],
        payoutSchedule: null,
        dashboardUrl: null,
        details: {
          chargesEnabled: false,
          payoutsEnabled: false,
          bankAccounts: [],
          dashboardUrl: null
        }
      });
    }

    const account = await stripe().accounts.retrieve(profile.stripeAccountId);
    const externalAccounts = (account.external_accounts?.data || []).map((ext: any) => ({
      id: ext.id,
      object: ext.object || "bank_account",
      bankName: ext.bank_name || ext.brand || "Cuenta Bancaria",
      last4: ext.last4 || "****",
      currency: (ext.currency || "mxn").toUpperCase(),
      routingNumber: ext.routing_number || null,
      status: ext.status || "verified",
      defaultForCurrency: Boolean(ext.default_for_currency)
    }));

    const isConnected = Boolean(account.charges_enabled && account.payouts_enabled);

    // Sync DB status if out of sync
    if (profile.stripeChargesEnabled !== isConnected) {
      await prisma.coachProfile.update({
        where: { id: profile.id },
        data: { stripeChargesEnabled: isConnected }
      });
    }

    let dashboardUrl: string | null = null;
    try {
      if (account.details_submitted || account.charges_enabled) {
        const loginLink = await stripe().accounts.createLoginLink(profile.stripeAccountId);
        dashboardUrl = loginLink.url;
      }
    } catch (linkErr) {
      console.warn("No se pudo generar enlace de Stripe Express Login:", linkErr);
    }

    const payoutSchedule = {
      interval: account.settings?.payouts?.schedule?.interval || "daily",
      delayDays: account.settings?.payouts?.schedule?.delay_days ?? 2
    };

    return NextResponse.json({
      connected: isConnected,
      isMock: false,
      accountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      externalAccounts,
      requirementsDue: account.requirements?.currently_due || [],
      payoutSchedule,
      dashboardUrl,
      details: {
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        bankAccounts: externalAccounts,
        dashboardUrl
      }
    });
  } catch (error: any) {
    console.error("Error obteniendo datos de cuenta de cobro de coach:", error);
    return NextResponse.json({ error: error?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
