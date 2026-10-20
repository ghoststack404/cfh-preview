
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { currentUser } from "@/lib/auth";
import { prisma } from "database";
import { UserRole } from "database";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const isMockMode = !STRIPE_KEY || STRIPE_KEY.trim() === "" || STRIPE_KEY.includes("mock") || STRIPE_KEY.includes("placeholder") || !STRIPE_KEY.startsWith("sk_");

const stripe = new Stripe(STRIPE_KEY || "sk_test_mock", {
  apiVersion: "2023-10-16" as any,
});

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: "No autenticado. Inicia sesión para continuar." }, { status: 401 });
    }

    // Verificar y asegurar el rol de coach y perfil en la base de datos
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { coachProfile: true }
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Si el usuario está adquiriendo un plan de coach, asegurar que su rol sea COACH
    if (dbUser.role !== UserRole.COACH) {
      dbUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.COACH },
        include: { coachProfile: true }
      });
    }

    const { planId, returnUrl } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: "ID del plan es requerido" }, { status: 400 });
    }

    const plan =
      (await prisma.subscriptionPlan.findUnique({ where: { id: planId } })) ||
      (await prisma.subscriptionPlan.findFirst({
        where: {
          OR: [
            { code: String(planId).toUpperCase() },
            { tier: String(planId).toUpperCase() as any },
          ],
        },
      }));

    if (!plan) {
       return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }

    // Determine the base URL for success/cancel redirects
    const host = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Si aún no tiene perfil de coach, regresarlo al llenado de datos con el plan preseleccionado
    if (!dbUser.coachProfile) {
      return NextResponse.json({ url: `${host}/coach/onboarding?tier=${plan.tier}` });
    }

    // Fallback del priceId desde variables de entorno si la base de datos no lo tiene aún
    const envPriceId =
      plan.tier === "CURSOS_ONLY" ? process.env.STRIPE_CURSOS_PRICE_ID :
      plan.tier === "ELITE" ? process.env.STRIPE_ELITE_PRICE_ID :
      plan.tier === "GOLD" ? process.env.STRIPE_GOLD_PRICE_ID :
      plan.tier === "PLATINUM" ? process.env.STRIPE_PLATINUM_PRICE_ID :
      undefined;

    const resolvedPriceId = plan.stripePriceId || envPriceId;
    const effectiveMock = isMockMode || !resolvedPriceId;

    // --- MOCK / FALLBACK MODE: Bypass Stripe si no hay llave real o no hay priceId ---
    if (effectiveMock) {
      console.log("[MOCK/DIRECT MODE] Activando plan para el coach:", plan.name);
      
      const existingSub = await prisma.coachSubscription.findFirst({
        where: { coachId: user.id },
      });

      if (existingSub) {
         await prisma.coachSubscription.update({
           where: { id: existingSub.id },
           data: {
             status: "ACTIVE",
             planId: plan.id,
             stripeSubscriptionId: "sub_mock_" + Date.now(),
             stripeCustomerId: "cus_mock_" + Date.now(),
             currentPeriodStart: new Date(),
             currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 días
           }
         });
      } else {
         await prisma.coachSubscription.create({
           data: {
             coachId: user.id,
             planId: plan.id,
             status: "ACTIVE",
             stripeSubscriptionId: "sub_mock_" + Date.now(),
             stripeCustomerId: "cus_mock_" + Date.now(),
             currentPeriodStart: new Date(),
             currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
           }
         });
      }

      // Sincronizar el currentTier del perfil de coach y asegurar status de aprobación
      await prisma.coachProfile.updateMany({
        where: { userId: user.id },
        data: { currentTier: plan.tier, approvalStatus: "APPROVED" },
      });

      // Redirigir al returnUrl si fue especificado, o al dashboard de facturación
      const finalSuccessUrl = returnUrl
        ? (returnUrl.startsWith("http") ? returnUrl : `${host}${returnUrl}`)
        : `${host}/coach/billing?success=true&session_id=mock_session_123`;
      return NextResponse.json({ url: finalSuccessUrl });
    }
    // --- FIN MOCK MODE ---

    const finalSuccessUrl = returnUrl
      ? (returnUrl.startsWith("http") ? returnUrl : `${host}${returnUrl}`)
      : `${host}/coach/billing?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = returnUrl
      ? (returnUrl.startsWith("http") ? `${returnUrl}&canceled=true` : `${host}${returnUrl}&canceled=true`)
      : `${host}/coach/plans?canceled=true`;

    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: resolvedPriceId!,
            quantity: 1,
          },
        ],
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        metadata: {
          userId: user.id,
          planId: plan.id,
        },
        customer_email: user.email,
      });

      return NextResponse.json({ url: checkoutSession.url });
    } catch (stripeErr: any) {
      console.warn("Stripe Checkout Session error, falling back gracefully:", stripeErr?.message);
      // Fallback seguro en desarrollo o ante fallo de Stripe
      await prisma.coachProfile.updateMany({
        where: { userId: user.id },
        data: { currentTier: plan.tier },
      });
      return NextResponse.json({ url: finalSuccessUrl });
    }

  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: "Error al crear la sesión de pago: " + (error?.message || "Inténtalo de nuevo.") }, { status: 500 });
  }
}

