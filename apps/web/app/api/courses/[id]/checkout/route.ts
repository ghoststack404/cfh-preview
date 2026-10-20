import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { calculatePlatformFee } from "@/lib/business";
import { activateCourseEnrollment } from "@/lib/course-payments";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isMockStripeAccount, paymentsMode, stripe, getOrCreateStripeCustomer } from "@/lib/payments";
import { assertSameOrigin } from "@/lib/security";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const course = await prisma.course.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        coach: {
          select: { name: true },
        },
      },
    });

    if (!course) {
      throw new Error("NOT_FOUND");
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: course.id,
          studentId: user.id,
        },
      },
    });

    return ok({
      course: {
        id: course.id,
        title: course.title,
        priceCents: course.priceCents,
        price: course.priceCents / 100,
        currency: course.currency,
        thumbnailUrl: course.thumbnailUrl,
        isEnrolled: existing ? ["ACTIVE", "COMPLETED"].includes(existing.status) : false,
        coach: {
          name: course.coach?.name || "Coach",
        },
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const student = await requireUser();
    const { id } = await context.params;
    const course = await prisma.course.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        coach: {
          include: {
            coachProfile: true,
            coachSubscriptions: {
              where: { status: { in: ["ACTIVE", "TRIALING"] } },
              include: { plan: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!course) throw new Error("NOT_FOUND");
    if (course.status === "ARCHIVED") {
      return Response.json({ error: "Este curso ya no está disponible para su compra." }, { status: 409 });
    }
    const existing = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: course.id, studentId: student.id } } });
    if (existing && ["ACTIVE", "COMPLETED"].includes(existing.status)) return ok({ url: `${env().APP_URL}/classroom/${course.id}` });
    if (existing?.status === "WITHDRAWN") return Response.json({ error: "Ya compraste este curso. Reactiva el acceso desde la publicación sin realizar otro pago." }, { status: 409 });
    const fee = calculatePlatformFee(course.priceCents, course.coach?.region, course.coach?.coachSubscriptions?.[0]?.plan);
    const enrollment = existing
      ? await prisma.enrollment.update({ where: { id: existing.id }, data: { status: "PENDING_PAYMENT", priceCents: course.priceCents, platformFeeCents: fee, currency: course.currency } })
      : await prisma.enrollment.create({ data: { courseId: course.id, studentId: student.id, status: "PENDING_PAYMENT", priceCents: course.priceCents, platformFeeCents: fee, currency: course.currency } });
    // FREE COURSE BYPASS
    if (course.priceCents === 0) {
      await activateCourseEnrollment({
        enrollmentId: enrollment.id,
        checkoutSessionId: `free_course_${enrollment.id}`,
        paymentIntentId: `free_course_payment_${enrollment.id}`,
      });
      await audit({ actorId: student.id, action: "COURSE_FREE_ENROLLED", entityType: "Course", entityId: course.id });
      return ok({ url: `${env().APP_URL}/classroom/${course.id}?payment=success` });
    }

    if (paymentsMode() === "mock") {
      await activateCourseEnrollment({
        enrollmentId: enrollment.id,
        checkoutSessionId: `mock_course_${enrollment.id}`,
        paymentIntentId: `mock_course_payment_${enrollment.id}`,
      });
      await audit({ actorId: student.id, action: "COURSE_MOCK_PURCHASED", entityType: "Course", entityId: course.id });
      return ok({ url: `${env().APP_URL}/classroom/${course.id}?payment=mock` });
    }

    const accountId = course.coach?.coachProfile?.stripeAccountId;
    if (!accountId || isMockStripeAccount(accountId) || !course.coach?.coachProfile?.stripeChargesEnabled) return Response.json({ error: "El coach todavía no puede recibir pagos." }, { status: 409 });
    const customerId = await getOrCreateStripeCustomer(student.email, student.name, student.id);

    let body: any = {};
    try {
      body = await _.json();
    } catch {}

    if (body.paymentMethodId) {
      try {
        const paymentIntent = await stripe().paymentIntents.create({
          amount: course.priceCents,
          currency: course.currency.toLowerCase(),
          customer: customerId,
          payment_method: body.paymentMethodId,
          off_session: true,
          confirm: true,
          application_fee_amount: fee,
          on_behalf_of: accountId,
          transfer_data: { destination: accountId },
          metadata: { type: "course_purchase", enrollmentId: enrollment.id, courseId: course.id }
        });

        if (paymentIntent.status === "succeeded") {
          await activateCourseEnrollment({
            enrollmentId: enrollment.id,
            checkoutSessionId: `direct_${paymentIntent.id}`,
            paymentIntentId: paymentIntent.id,
          });
          return ok({ url: `${env().APP_URL}/classroom/${course.id}?payment=success` });
        }
      } catch (pmErr: any) {
        console.warn("Error cobrando tarjeta en 1 clic (cursos), redirigiendo a checkout:", pmErr?.message);
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
      invoice_creation: { enabled: true },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${env().APP_URL}/classroom/${course.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env().APP_URL}/cursos/${course.id}?course=canceled`,
      line_items: [{ quantity: 1, price_data: { currency: course.currency.toLowerCase(), unit_amount: course.priceCents, product_data: { name: course.title, description: course.summary } } }],
      payment_intent_data: { application_fee_amount: fee, on_behalf_of: accountId, transfer_data: { destination: accountId }, metadata: { type: "course_purchase", enrollmentId: enrollment.id, courseId: course.id } },
      metadata: { type: "course_purchase", enrollmentId: enrollment.id, courseId: course.id },
    });
    if (!session.url) return Response.json({ error: "Stripe no devolvió una dirección de pago." }, { status: 502 });
    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { stripeCheckoutSessionId: session.id } });
    return ok({ url: session.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
