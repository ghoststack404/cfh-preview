import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isMockStripeAccount, paymentsMode, stripe, getOrCreateStripeCustomer } from "@/lib/payments";
import { assertSameOrigin } from "@/lib/security";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["STUDENT"]);
    const { id } = await context.params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { coach: { include: { coachProfile: true } }, student: true, conversation: true } });
    if (!booking || booking.studentId !== user.id) throw new Error("NOT_FOUND");
    if (booking.status === "CONFIRMED") return ok({ url: `${env().APP_URL}/dashboard?paid=1` });
    if (!["PENDING_PAYMENT", "REQUESTED"].includes(booking.status) || booking.priceCents <= 0) return Response.json({ error: "Esta reserva no está pendiente de pago." }, { status: 409 });
    if (paymentsMode() === "mock") {
      await prisma.$transaction([
        prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", stripeCheckoutSessionId: `mock_session_${booking.id}`, stripePaymentIntentId: `mock_payment_${booking.id}` } }),
        prisma.conversation.updateMany({ where: { bookingId: booking.id }, data: { contactUnlockedAt: new Date() } }),
        prisma.notification.create({ data: { userId: booking.coachId, type: "PAYMENT", title: "Pago confirmado", body: `La sesión con ${booking.student.name} quedó confirmada en modo demostración.`, link: "/dashboard/bookings" } })
      ]);
      await audit({ actorId: user.id, action: "BOOKING_MOCK_PAID", entityType: "Booking", entityId: booking.id });
      return ok({ url: `${env().APP_URL}/dashboard?paid=mock` });
    }
    const accountId = booking.coach.coachProfile?.stripeAccountId;
    if (!accountId || isMockStripeAccount(accountId) || !booking.coach.coachProfile?.stripeChargesEnabled) return Response.json({ error: "El coach todavía no puede recibir pagos. Elige otro horario o contacta a soporte." }, { status: 409 });
    const customerId = await getOrCreateStripeCustomer(booking.student.email, booking.student.name, booking.student.id);

    let body: any = {};
    try {
      body = await _.json();
    } catch {}

    if (body.paymentMethodId) {
      try {
        const paymentIntent = await stripe().paymentIntents.create({
          amount: booking.priceCents,
          currency: booking.currency.toLowerCase(),
          customer: customerId,
          payment_method: body.paymentMethodId,
          off_session: true,
          confirm: true,
          capture_method: "manual",
          application_fee_amount: booking.platformFeeCents,
          on_behalf_of: accountId,
          transfer_data: { destination: accountId },
          metadata: { bookingId: booking.id, type: "booking" }
        });

        if (paymentIntent.status === "requires_capture" || paymentIntent.status === "succeeded") {
          await prisma.$transaction([
            prisma.booking.update({
              where: { id: booking.id },
              data: {
                status: "REQUESTED",
                stripePaymentIntentId: paymentIntent.id,
              }
            }),
            prisma.notification.create({
              data: {
                userId: booking.coachId,
                type: "PAYMENT",
                title: "Nueva solicitud de sesión",
                body: `${booking.student.name} ha solicitado una sesión y su pago está pre-autorizado. Confirma para agendar.`,
                link: "/coach/dashboard#agenda"
              }
            })
          ]);
          await audit({ actorId: user.id, action: "BOOKING_HELD_SAVED_CARD", entityType: "Booking", entityId: booking.id, metadata: { paymentIntentId: paymentIntent.id } });
          return ok({ url: `${env().APP_URL}/dashboard?booking_held=1` });
        }
      } catch (pmErr: any) {
        console.warn("Error cobrando tarjeta guardada en 1 clic, redirigiendo a checkout:", pmErr?.message);
      }
    }

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      customer_update: {
        address: "auto",
        name: "auto",
      },
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${env().APP_URL}/dashboard/bookings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env().APP_URL}/dashboard?canceled=1`,
      line_items: [{ quantity: 1, price_data: { currency: booking.currency.toLowerCase(), unit_amount: booking.priceCents, product_data: { name: `Sesión con ${booking.coach.name}`, description: `${Math.round((booking.endAt.getTime() - booking.startAt.getTime()) / 60000)} minutos en Coaching From Home` } } }],
      payment_intent_data: {
        capture_method: "manual",
        application_fee_amount: booking.platformFeeCents,
        on_behalf_of: accountId,
        transfer_data: { destination: accountId },
        metadata: { bookingId: booking.id, type: "booking" }
      },
      metadata: { bookingId: booking.id, type: "booking" }
    });
    await prisma.booking.update({ where: { id: booking.id }, data: { stripeCheckoutSessionId: session.id } });
    await audit({ actorId: user.id, action: "BOOKING_CHECKOUT_CREATED", entityType: "Booking", entityId: booking.id, metadata: { stripeSessionId: session.id } });
    return ok({ url: session.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
