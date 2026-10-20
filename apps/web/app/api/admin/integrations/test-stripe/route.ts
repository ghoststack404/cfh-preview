import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { env } from "@/lib/env";
import { stripe } from "@/lib/payments";
import { assertSameOrigin } from "@/lib/security";

export async function POST() {
  try {
    await assertSameOrigin();
    await requireUser(["ADMIN"]);
    const config = env();
    if (config.PAYMENTS_MODE !== "stripe") {
      return Response.json({ message: "Stripe está en modo de demostración. Los flujos se simulan y no se realiza ningún cargo." });
    }
    const [balance, accounts] = await Promise.all([
      stripe().balance.retrieve(),
      stripe().accounts.list({ limit: 1 })
    ]);
    const currencies = balance.available.map((item) => item.currency.toUpperCase()).join(", ") || "sin saldo disponible";
    const connect = accounts.data.length ? "la plataforma puede consultar cuentas conectadas" : "la plataforma respondió, pero todavía no hay cuentas conectadas reales";
    return Response.json({ message: `Stripe respondió correctamente; ${connect}. Monedas disponibles: ${currencies}.` });
  } catch (error) {
    return handleRouteError(error);
  }
}
