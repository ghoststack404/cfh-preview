import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { paymentsMode, stripe, isMockStripeAccount, getOrCreateStripeCustomer } from "@/lib/payments";
import { activateCourseEnrollment } from "@/lib/course-payments";
import { calculatePlatformFee } from "@/lib/business";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 1. Obtener el carrito actualizado directamente de la Base de Datos (Única Fuente de Verdad)
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            course: {
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
            },
          },
        },
      },
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { error: "El carrito está vacío. Agrega cursos antes de pagar." },
        { status: 400 }
      );
    }

    // 2. Revalidar y calcular montos exactos de todos los cursos
    
    // Validar estado de los cursos y Stripe Connect de los coaches
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        studentId: user.id,
        courseId: { in: cart.items.map(i => i.courseId) },
        status: { in: ["ACTIVE", "COMPLETED"] }
      }
    });
    
    const boughtCourseIds = new Set(activeEnrollments.map(e => e.courseId));
    
    for (const item of cart.items) {
      if (item.course.status !== "PUBLISHED") {
        return NextResponse.json({ error: `El curso "${item.course.title}" no está publicado.` }, { status: 400 });
      }
      if (boughtCourseIds.has(item.course.id)) {
        return NextResponse.json({ error: `Ya tienes acceso al curso "${item.course.title}".` }, { status: 400 });
      }
      if (paymentsMode() !== "mock") {
        const coachProfile = item.course.coach?.coachProfile;
        if (!coachProfile?.stripeAccountId || !coachProfile?.stripeChargesEnabled) {
          return NextResponse.json({ error: `El coach del curso "${item.course.title}" no puede recibir pagos en este momento.` }, { status: 400 });
        }
      }
    }

    const totalCents = cart.items.reduce((acc, item) => acc + (item.course?.priceCents || 0), 0);
    const currency = cart.items[0]?.course?.currency || "USD";

    // 3. Procesar en modo mock / desarrollo
    if (paymentsMode() === "mock") {
      for (const item of cart.items) {
        const course = item.course;
        const fee = calculatePlatformFee(
          course.priceCents,
          course.coach.region,
          course.coach.coachSubscriptions?.[0]?.plan
        );

        const existing = await prisma.enrollment.findUnique({
          where: {
            courseId_studentId: {
              courseId: course.id,
              studentId: user.id,
            },
          },
        });

        let enrollment;
        if (existing) {
          enrollment = await prisma.enrollment.update({
            where: { id: existing.id },
            data: {
              status: "PENDING_PAYMENT",
              priceCents: course.priceCents,
              platformFeeCents: fee,
              currency: course.currency,
            },
          });
        } else {
          enrollment = await prisma.enrollment.create({
            data: {
              courseId: course.id,
              studentId: user.id,
              status: "PENDING_PAYMENT",
              priceCents: course.priceCents,
              platformFeeCents: fee,
              currency: course.currency,
            },
          });
        }

        await activateCourseEnrollment({
          enrollmentId: enrollment.id,
          checkoutSessionId: `mock_cart_${enrollment.id}_${Date.now()}`,
          paymentIntentId: `mock_cart_pi_${enrollment.id}`,
        });

        await audit({
          actorId: user.id,
          action: "COURSE_MOCK_PURCHASED",
          entityType: "Course",
          entityId: course.id,
        });
      }

      // Vaciar carrito en base de datos tras la compra exitosa
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return NextResponse.json({
        success: true,
        redirectUrl: "/dashboard?payment=success",
        totalCents,
        currency,
        itemsCount: cart.items.length,
      });
    }

    // 3.5. FREE CART BYPASS (Si el total es $0, omitir Stripe y activar accesos)
    if (totalCents === 0) {
      for (const item of cart.items) {
        const existing = await prisma.enrollment.findUnique({
          where: { courseId_studentId: { courseId: item.course.id, studentId: user.id } }
        });
        
        if (!existing) {
          await prisma.enrollment.create({
            data: {
              courseId: item.course.id,
              studentId: user.id,
              status: 'ACTIVE',
              enrolledAt: new Date(),
              stripeCheckoutSessionId: `free_cart_${cart.id}_${Date.now()}`,
              stripePaymentIntentId: `free_cart_pi_${cart.id}`,
              priceCents: 0,
              platformFeeCents: 0,
              currency: item.course.currency || currency,
            }
          });
        }
      }
      // Vaciar carrito
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      
      return NextResponse.json({
        success: true,
        url: `${env().APP_URL}/dashboard?payment=success`,
        totalCents: 0,
        currency,
      });
    }

    // 4. Procesar en modo Stripe si está configurado
    const lineItems = cart.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency: (item.course.currency || "USD").toLowerCase(),
        unit_amount: item.course.priceCents,
        product_data: {
          name: item.course.title,
          description: `Curso impartido por ${item.course.coach?.name || "Coach CFH"}`,
        },
      },
    }));

    const customerId = await getOrCreateStripeCustomer(user.email, user.name, user.id);

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    if (body.paymentMethodId) {
      try {
        const paymentIntent = await stripe().paymentIntents.create({
          amount: totalCents,
          currency: currency.toLowerCase(),
          customer: customerId,
          payment_method: body.paymentMethodId,
          off_session: true,
          confirm: true,
          transfer_group: `cart_${cart.id}`,
          metadata: {
            type: "cart_checkout",
            userId: user.id,
            cartId: cart.id,
            itemsCount: cart.items.length.toString(),
          }
        });

        if (paymentIntent.status === "succeeded") {
          // Create the enrollments
          for (const item of cart.items) {
            const existing = await prisma.enrollment.findUnique({
              where: { courseId_studentId: { courseId: item.course.id, studentId: user.id } }
            });
            
            if (!existing) {
              await prisma.enrollment.create({
                data: {
                  courseId: item.course.id,
                  studentId: user.id,
                  status: 'ACTIVE',
                  enrolledAt: new Date(),
                  stripeCheckoutSessionId: `direct_${paymentIntent.id}`,
                  stripePaymentIntentId: paymentIntent.id,
                  priceCents: item.course.priceCents,
                  platformFeeCents: 0,
                  currency: item.course.currency,
                }
              });
            }
          }
          await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
          
          return NextResponse.json({
            success: true,
            url: `${env().APP_URL}/dashboard?payment=success`,
            totalCents,
            currency,
          });
        }
      } catch (pmErr: any) {
        console.warn("Error cobrando tarjeta en 1 clic (cart), redirigiendo a checkout:", pmErr?.message);
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
      payment_intent_data: {
        transfer_group: `cart_${cart.id}`,
      },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${env().APP_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env().APP_URL}/checkout?payment=canceled`,
      line_items: lineItems,
      metadata: {
        type: "cart_checkout",
        userId: user.id,
        cartId: cart.id,
        itemsCount: cart.items.length.toString(),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe no devolvió una dirección de pago válida." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: session.url,
      totalCents,
      currency,
    });
  } catch (error) {
    console.error("Cart Checkout Error:", error);
    return NextResponse.json(
      { error: "Error procesando el checkout del carrito" },
      { status: 500 }
    );
  }
}
