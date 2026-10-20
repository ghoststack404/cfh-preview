
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const isMockMode = !STRIPE_KEY || STRIPE_KEY.trim() === "";

const stripe = new Stripe(STRIPE_KEY || "sk_test_mock", {
  apiVersion: "2023-10-16" as any,
});

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const sub = await prisma.coachSubscription.findFirst({
      where: {
        coachId: user.id,
        status: { in: ["ACTIVE", "PAST_DUE", "TRIALING"] }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!sub || !sub.stripeCustomerId) {
      return NextResponse.json({ error: "No tienes una suscripcion activa o pendiente con un cliente de Stripe asociado." }, { status: 400 });
    }

    const host = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (isMockMode || sub.stripeCustomerId.startsWith("cus_mock")) {
       console.log("[MOCK MODE] Simulado cancelar suscripcion.");
       // En mock mode, lo cancelamos de inmediato y redirigimos
       await prisma.coachSubscription.update({
         where: { id: sub.id },
         data: { status: "CANCELED" }
       });
       return NextResponse.json({ url: `${host}/coach/plans?canceled_mock=true` });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${host}/coach/plans`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("Stripe Portal Error:", error);
    return NextResponse.json({ error: "Error al crear el portal de facturacion" }, { status: 500 });
  }
}

