import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { handleRouteError, ok, fail } from "@/lib/api";
import { paymentsMode, stripe } from "@/lib/payments";

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

declare global {
  var __cfh_mock_wallet: Map<string, SavedCard[]> | undefined;
}

function getMockWalletStore(): Map<string, SavedCard[]> {
  if (!globalThis.__cfh_mock_wallet) {
    globalThis.__cfh_mock_wallet = new Map<string, SavedCard[]>();
  }
  return globalThis.__cfh_mock_wallet;
}

function getUserMockCards(userId: string): SavedCard[] {
  const store = getMockWalletStore();
  if (!store.has(userId)) {
    store.set(userId, [
      {
        id: `pm_mock_visa_${userId.slice(0, 5)}`,
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2028,
        isDefault: true,
      },
    ]);
  }
  return store.get(userId)!;
}

export async function GET() {
  try {
    let user: any = await currentUser();
    if (!user) {
      user = await getAuthenticatedUser();
    }
    if (!user) {
      return fail("No autenticado", 401);
    }

    if (paymentsMode() === "mock") {
      const cards = getUserMockCards(user.id);
      return ok({ paymentMethods: cards });
    }

    // Stripe Live Mode
    const stripeClient = stripe();
    const customers = await stripeClient.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0 || !customers.data[0]) {
      return ok({ paymentMethods: [] });
    }

    const customerId = customers.data[0].id;
    const paymentMethods = await stripeClient.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    const customer = await stripeClient.customers.retrieve(customerId);
    const defaultPmId = (customer as any).invoice_settings?.default_payment_method;

    const cards: SavedCard[] = paymentMethods.data.map((pm, index) => ({
      id: pm.id,
      brand: pm.card?.brand || "visa",
      last4: pm.card?.last4 || "0000",
      expMonth: pm.card?.exp_month || 12,
      expYear: pm.card?.exp_year || 2028,
      isDefault: defaultPmId ? defaultPmId === pm.id : index === 0,
    }));

    return ok({ paymentMethods: cards });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return fail("No autenticado", 401);
    }

    const body = await req.json();

    if (paymentsMode() === "mock") {
      const brand = (body.brand || "visa").toLowerCase();
      const last4 = (body.last4 || "4242").replace(/\D/g, "").slice(-4) || "4242";
      const expMonth = Number(body.expMonth) || 12;
      const expYear = Number(body.expYear) || 2028;

      const userCards = getUserMockCards(user.id);
      const isFirst = userCards.length === 0;

      const newCard: SavedCard = {
        id: `pm_mock_${brand}_${Date.now().toString(36)}`,
        brand,
        last4,
        expMonth,
        expYear,
        isDefault: body.isDefault || isFirst,
      };

      if (newCard.isDefault) {
        userCards.forEach((c) => (c.isDefault = false));
      }

      userCards.unshift(newCard);
      getMockWalletStore().set(user.id, userCards);

      return ok({ success: true, paymentMethod: newCard });
    }

    // Stripe Live Mode
    const stripeClient = stripe();
    const existing = await stripeClient.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId: string;
    if (existing.data.length > 0 && existing.data[0]) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
    }

    if (body.paymentMethodId) {
      await stripeClient.paymentMethods.attach(body.paymentMethodId, {
        customer: customerId,
      });

      if (body.isDefault) {
        await stripeClient.customers.update(customerId, {
          invoice_settings: { default_payment_method: body.paymentMethodId },
        });
      }
    }

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
