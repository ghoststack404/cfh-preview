import { sendCoursePurchaseEmail, sendBookingConfirmationEmail } from '@/lib/email';
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { activateCourseEnrollment, syncCourseEnrollmentCount } from "@/lib/course-payments";
import { calculatePlatformFee } from "@/lib/business";
import { env, requireIntegration } from "@/lib/env";
import { stripe } from "@/lib/payments";

function subscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active") return "ACTIVE" as const;
  if (status === "trialing") return "TRIALING" as const;
  if (status === "past_due" || status === "unpaid") return "PAST_DUE" as const;
  if (status === "canceled") return "CANCELED" as const;
  return "INACTIVE" as const;
}

export async function POST(request: Request) {
  if (env().PAYMENTS_MODE !== "stripe") return Response.json({ error: "Stripe está desactivado." }, { status: 503 });
  requireIntegration(["STRIPE_WEBHOOK_SECRET"], "Webhook de Stripe");
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Falta la firma de Stripe." }, { status: 400 });
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch {
    return Response.json({ error: "Firma inválida." }, { status: 400 });
  }
  try {
    await prisma.$transaction(async (tx) => {
      const seen = await tx.stripeEvent.findUnique({ where: { id: event.id } });
      if (seen) return;
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
        const session = event.data.object as Stripe.Checkout.Session;
        const type = session.metadata?.type;
        if (type === "booking") {
          const bookingId = session.metadata?.bookingId;
          if (bookingId) {
            const booking = await tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED", stripeCheckoutSessionId: session.id, stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id }, include: { student: true, coach: true } });
            if (booking && booking.student && booking.coach) {
              await sendBookingConfirmationEmail(booking.student.email, booking.student.name, booking.coach.name, booking.startAt);
            }
            await tx.conversation.updateMany({ where: { bookingId }, data: { contactUnlockedAt: new Date() } });
            await tx.notification.createMany({ data: [
              { userId: booking.studentId, type: "PAYMENT", title: "Pago confirmado", body: "Tu sesión quedó confirmada.", link: "/dashboard/bookings" },
              { userId: booking.coachId, type: "PAYMENT", title: "Pago confirmado", body: "Una sesión pagada quedó confirmada.", link: "/dashboard/bookings" }
            ] });
          }
        }
        if (type === "course_purchase" && session.payment_status === "paid") {
          const enrollmentId = session.metadata?.enrollmentId;
          if (enrollmentId) {
            await activateCourseEnrollment({
              enrollmentId,
              checkoutSessionId: session.id,
              paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
              tx
            });
          }
        }
        if (type === "cart_checkout" && (session.payment_status === "paid" || session.status === "complete")) {
          const userId = session.metadata?.userId;
          const cartId = session.metadata?.cartId;
          if (userId) {
            const cart = await tx.cart.findFirst({
              where: cartId ? { id: cartId } : { userId },
              include: {
                items: {
                  include: {
                    course: {
                      include: {
                        coach: {
                          include: {
                            coachSubscriptions: {
                              where: { status: { in: ["ACTIVE", "TRIALING"] } },
                              include: { plan: true },
                              orderBy: { createdAt: "desc" },
                              take: 1
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            });

            if (cart && cart.items.length > 0) {
              const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
              for (const item of cart.items) {
                const course = item.course;
                const fee = calculatePlatformFee(
                  course.priceCents,
                  course.coach.region,
                  course.coach.coachSubscriptions?.[0]?.plan
                );

                const existing = await tx.enrollment.findUnique({
                  where: {
                    courseId_studentId: {
                      courseId: course.id,
                      studentId: userId
                    }
                  }
                });

                let enrollment;
                if (existing) {
                  enrollment = await tx.enrollment.update({
                    where: { id: existing.id },
                    data: {
                      status: "PENDING_PAYMENT",
                      priceCents: course.priceCents,
                      platformFeeCents: fee,
                      currency: course.currency
                    }
                  });
                } else {
                  enrollment = await tx.enrollment.create({
                    data: {
                      courseId: course.id,
                      studentId: userId,
                      status: "PENDING_PAYMENT",
                      priceCents: course.priceCents,
                      platformFeeCents: fee,
                      currency: course.currency
                    }
                  });
                }

                await activateCourseEnrollment({
                  enrollmentId: enrollment.id,
                  checkoutSessionId: session.id,
                  paymentIntentId,
                  tx
                });
              }

              await tx.cartItem.deleteMany({
                where: { cartId: cart.id }
              });

              await tx.notification.create({
                data: {
                  userId,
                  type: "PAYMENT",
                  title: "Compra de cursos confirmada",
                  body: `Tu compra de ${cart.items.length} curso(s) ha sido activada con éxito. ¡Empieza a aprender ya!`,
                  link: "/dashboard"
                }
              });
            }
          }
        }
        if (type === "coach_subscription") {
          const coachId = session.metadata?.coachId;
          const planCode = session.metadata?.planCode;
          if (coachId && planCode) {
            const plan = await tx.subscriptionPlan.findUnique({ where: { code: planCode } });
            if (plan) {
              await tx.coachSubscription.updateMany({ where: { coachId, status: { in: ["ACTIVE", "TRIALING"] } }, data: { status: "CANCELED" } });
              await tx.coachSubscription.create({ data: { coachId, planId: plan.id, status: "ACTIVE", stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id, stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id } });
            }
          }
        }
      }
      if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
        const subscription = event.data.object as any;
        const coachId = subscription.metadata.coachId;
        const planCode = subscription.metadata.planCode;
        if (coachId && planCode) {
          const plan = await tx.subscriptionPlan.findUnique({ where: { code: planCode } });
          if (plan) {
            await tx.coachSubscription.upsert({
              where: { stripeSubscriptionId: subscription.id },
              create: { coachId, planId: plan.id, stripeSubscriptionId: subscription.id, stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id, status: subscriptionStatus(subscription.status), currentPeriodStart: new Date(subscription.current_period_start * 1000), currentPeriodEnd: new Date(subscription.current_period_end * 1000), cancelAtPeriodEnd: subscription.cancel_at_period_end },
              update: { planId: plan.id, status: subscriptionStatus(subscription.status), currentPeriodStart: new Date(subscription.current_period_start * 1000), currentPeriodEnd: new Date(subscription.current_period_end * 1000), cancelAtPeriodEnd: subscription.cancel_at_period_end }
              });
              if (subscription.status === "active" || subscription.status === "trialing") {
                await tx.coachProfile.updateMany({ where: { userId: coachId }, data: { currentTier: plan.tier } });
              } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
                await tx.coachProfile.updateMany({ where: { userId: coachId }, data: { currentTier: "BASIC" } });
              }
            }
        }
      }
      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSub = (invoice as any).subscription;
        const subId = typeof invoiceSub === "string" ? invoiceSub : invoiceSub?.id;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (subId || customerId) {
          const targetSub = await tx.coachSubscription.findFirst({
            where: subId ? { stripeSubscriptionId: subId } : { stripeCustomerId: customerId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
            orderBy: { createdAt: "desc" },
          });
          if (targetSub) {
            const gracePeriodEndsAt = targetSub.gracePeriodEndsAt || new Date(Date.now() + 3 * 86400 * 1000);
            await tx.coachSubscription.update({
              where: { id: targetSub.id },
              data: {
                status: "PAST_DUE",
                gracePeriodEndsAt,
              },
            });
            await tx.notification.create({
              data: {
                userId: targetSub.coachId,
                type: "PAYMENT",
                title: "Pago de suscripción fallido (Período de gracia)",
                body: "El cobro de tu suscripción ha fallado. Cuentas con 3 días de gracia (72 horas) para actualizar tu tarjeta en el portal de facturación antes de que se restrinjan tus funciones.",
                link: "/coach/billing",
              },
            });
          }
        }
      }
      if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSub = (invoice as any).subscription;
        const subId = typeof invoiceSub === "string" ? invoiceSub : invoiceSub?.id;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (subId || customerId) {
          const targetSub = await tx.coachSubscription.findFirst({
            where: subId ? { stripeSubscriptionId: subId } : { stripeCustomerId: customerId },
            orderBy: { createdAt: "desc" },
          });
          if (targetSub) {
            await tx.coachSubscription.update({
              where: { id: targetSub.id },
              data: {
                status: "ACTIVE",
                gracePeriodEndsAt: null,
              },
            });
            await tx.notification.create({
              data: {
                userId: targetSub.coachId,
                type: "PAYMENT",
                title: "Suscripción activa",
                body: "El pago de tu suscripción se completó con éxito.",
                link: "/coach/billing",
              },
            });
          }
        }
      }
      if (event.type === "account.updated") {
        const account = event.data.object as Stripe.Account;
        const userId = account.metadata?.userId;
        if (userId) await tx.coachProfile.updateMany({ where: { userId, stripeAccountId: account.id }, data: { stripeChargesEnabled: Boolean(account.charges_enabled && account.payouts_enabled) } });
      }
      if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === "booking" && session.metadata.bookingId) await tx.booking.updateMany({ where: { id: session.metadata.bookingId, status: "PENDING_PAYMENT" }, data: { status: "CANCELED", canceledAt: new Date() } });
        if (session.metadata?.type === "course_purchase" && session.metadata.enrollmentId) {
          await tx.enrollment.updateMany({ where: { id: session.metadata.enrollmentId, status: "PENDING_PAYMENT" }, data: { stripeCheckoutSessionId: null } });
        }
      }
      if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          await tx.booking.updateMany({ where: { stripePaymentIntentId: paymentIntentId }, data: { status: "REFUNDED" } });
          const affectedEnrollments = await tx.enrollment.findMany({ where: { stripePaymentIntentId: paymentIntentId }, select: { courseId: true } });
          await tx.enrollment.updateMany({ where: { stripePaymentIntentId: paymentIntentId }, data: { status: "REFUNDED" } });
          for (const courseId of new Set(affectedEnrollments.map((item) => item.courseId))) {
            await syncCourseEnrollmentCount(courseId, tx);
          }
        }
      }
      await tx.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue
        }
      });
    });
    return Response.json({ received: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "No se pudo procesar el evento." }, { status: 500 });
  }
}

