import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { handleRouteError, ok, fail } from "@/lib/api";
import { paymentsMode, stripe } from "@/lib/payments";
import { SavedCard } from "../route";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return fail("No autenticado", 401);
    }

    const { id } = await context.params;
    if (!id) {
      return fail("ID de método de pago requerido", 400);
    }

    if (paymentsMode() === "mock") {
      const store = (globalThis as any).__cfh_mock_wallet as Map<string, SavedCard[]> | undefined;
      if (store && store.has(user.id)) {
        const cards = store.get(user.id)!;
        const filtered = cards.filter((c) => c.id !== id);
        // If we deleted the default card, make the first remaining card default
        if (filtered.length > 0 && !filtered.some((c) => c.isDefault)) {
          const first = filtered[0];
          if (first) {
            first.isDefault = true;
          }
        }
        store.set(user.id, filtered);
      }
      return ok({ success: true });
    }

    // Stripe Live Mode
    const stripeClient = stripe();

    // Verify ownership
    const customers = await stripeClient.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0 || !customers.data[0]) {
      return fail("Cliente no encontrado", 404);
    }

    const customerId = customers.data[0].id;
    const pm = await stripeClient.paymentMethods.retrieve(id);

    if (pm.customer !== customerId) {
      return fail("No tienes permiso para eliminar este método de pago", 403);
    }

    await stripeClient.paymentMethods.detach(id);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return fail("No autenticado", 401);
    }

    const { id } = await context.params;
    if (!id) {
      return fail("ID de método de pago requerido", 400);
    }

    if (paymentsMode() === "mock") {
      const store = (globalThis as any).__cfh_mock_wallet as Map<string, SavedCard[]> | undefined;
      if (store && store.has(user.id)) {
        const cards = store.get(user.id)!;
        cards.forEach((c) => {
          c.isDefault = c.id === id;
        });
        store.set(user.id, cards);
      }
      return ok({ success: true });
    }

    // Stripe Live Mode
    const stripeClient = stripe();
    const customers = await stripeClient.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0 || !customers.data[0]) {
      return fail("Cliente no encontrado", 404);
    }

    const customerId = customers.data[0].id;
    await stripeClient.customers.update(customerId, {
      invoice_settings: { default_payment_method: id },
    });

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
