import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { handleRouteError, ok, fail } from "@/lib/api";
import { paymentsMode, stripe } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return fail("No autenticado", 401);
    }

    if (paymentsMode() === "mock") {
      const mockSecret = `seti_mock_${user.id.slice(0, 8)}_${Date.now()}`;
      const mockCustomerId = `cus_mock_${user.id}`;
      return ok({
        clientSecret: mockSecret,
        customerId: mockCustomerId,
      });
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
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        userId: user.id,
      },
    });

    return ok({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
