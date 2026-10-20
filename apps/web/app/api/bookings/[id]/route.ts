import { z } from "zod";
import { generateAiArtifact } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { refreshCoachReputation } from "@/lib/coach";
import { prisma } from "@/lib/db";
import { paymentsMode, stripe } from "@/lib/payments";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  status: z.enum(["COMPLETED", "CANCELED", "NO_SHOW"]).optional(),
  action: z.enum(["COMPLETE", "CANCEL", "REPORT_COACH_ABSENT", "REPORT_STUDENT_ABSENT", "RESCHEDULE"]).optional(),
  reason: z.string().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const booking = await prisma.booking.findUnique({ where: { id }, include: { conversation: { include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } } } } });
    if (!booking) throw new Error("NOT_FOUND");
    const participant = user.role === "ADMIN" || user.id === booking.studentId || user.id === booking.coachId;
    if (!participant) throw new Error("FORBIDDEN");

    if (input.status === "COMPLETED" || input.action === "COMPLETE") {
      if (user.role !== "ADMIN" && user.id !== booking.coachId) throw new Error("FORBIDDEN");
      if (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status)) return Response.json({ error: "Esta sesión no puede marcarse como completada." }, { status: 409 });
      await prisma.booking.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await refreshCoachReputation(booking.coachId);
      const conversation = booking.conversation?.messages.map((message) => `${message.senderId === booking.coachId ? "Coach" : "Aprendiz"}: ${message.content}`).join("\n") ?? "";
      let automaticArtifacts = 0;
      try {
        const result = await generateAiArtifact({
          type: "SESSION_SUMMARY",
          role: "COACH",
          prompt: `Resume la sesión sin inventar datos. Notas de reserva: ${booking.notes || "Sin notas"}. Conversación previa: ${conversation || "Sin mensajes"}. Incluye acuerdos y próximos pasos prudentes.`
        });
        const artifact = await prisma.aiArtifact.create({ data: { userId: booking.coachId, bookingId: booking.id, type: "SESSION_SUMMARY", title: "Resumen automático de sesión", prompt: booking.notes || "Resumen posterior a la sesión", content: result.content, provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens } });
        automaticArtifacts += 1;
        await audit({ actorId: booking.coachId, action: "AI_SESSION_SUMMARY_CREATED", entityType: "AiArtifact", entityId: artifact.id });
      } catch (summaryError) {
        console.error("No se pudo crear el resumen automático", summaryError);
      }
      if (conversation.trim().length >= 40) {
        try {
          const insight = await generateAiArtifact({
            type: "EMOTIONAL_INSIGHTS",
            role: "COACH",
            prompt: `Analiza únicamente señales observables en esta conversación previa a la sesión. No diagnostiques ni afirmes emociones como hechos. Conversación: ${conversation}`
          });
          const artifact = await prisma.aiArtifact.create({ data: { userId: booking.coachId, bookingId: booking.id, type: "EMOTIONAL_INSIGHTS", title: "Observaciones emocionales para revisión", prompt: "Observaciones automáticas posteriores a la sesión", content: insight.content, provider: insight.provider, model: insight.model, inputTokens: insight.inputTokens, outputTokens: insight.outputTokens } });
          automaticArtifacts += 1;
          await audit({ actorId: booking.coachId, action: "AI_EMOTIONAL_INSIGHTS_CREATED", entityType: "AiArtifact", entityId: artifact.id });
        } catch (insightError) {
          console.error("No se pudieron crear las observaciones emocionales", insightError);
        }
      }
      if (automaticArtifacts > 0) {
        await prisma.notification.create({ data: { userId: booking.coachId, type: "SYSTEM", title: "Material post-sesión listo", body: `Coach Assistant preparó ${automaticArtifacts} borrador${automaticArtifacts === 1 ? "" : "es"} para que los revises.`, link: "/dashboard/ai" } });
      }
      await audit({ actorId: user.id, action: "BOOKING_COMPLETED", entityType: "Booking", entityId: id });
      return ok({ success: true });
    }

    if (!["REQUESTED", "PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS"].includes(booking.status)) {
      return Response.json({ error: "Esta sesión ya no puede cancelarse ni reportarse." }, { status: 409 });
    }

    const minutesElapsed = Math.floor((Date.now() - new Date(booking.startAt).getTime()) / (60 * 1000));
    const isCoachAbsence = input.action === "REPORT_COACH_ABSENT" || (user.id === booking.studentId && input.reason === "COACH_ABSENT");
    const isStudentAbsence = input.action === "REPORT_STUDENT_ABSENT" || (user.id === booking.coachId && (input.reason === "STUDENT_ABSENT" || input.status === "NO_SHOW"));

    // Case 1: Coach absence reported by student
    if (isCoachAbsence) {
      if (minutesElapsed < 30) {
        return Response.json({
          error: "Debes esperar al menos 30 minutos de tolerancia antes de reportar la ausencia del coach.",
          action: "WAIT_TOLERANCE"
        }, { status: 422 });
      }

      if (booking.stripePaymentIntentId && !booking.stripePaymentIntentId.startsWith("mock_") && paymentsMode() === "stripe") {
        await stripe().refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          reverse_transfer: true,
          refund_application_fee: true,
          metadata: { bookingId: booking.id, reason: "COACH_ABSENT" }
        });
        await prisma.booking.update({ where: { id }, data: { status: "REFUNDED", canceledAt: new Date() } });
      } else {
        await prisma.booking.update({ where: { id }, data: { status: "REFUNDED", canceledAt: new Date() } });
      }

      await prisma.notification.createMany({
        data: [
          { userId: booking.coachId, type: "SYSTEM", title: "Ausencia de Coach reportada", body: "El estudiante reportó tu ausencia tras cumplirse los 30 min de tolerancia.", link: "/dashboard/bookings" },
          { userId: booking.studentId, type: "PAYMENT", title: "Reembolso por ausencia de coach", body: "Se ha confirmado la inasistencia del coach. El reembolso/reagendamiento ha sido procesado.", link: "/dashboard/bookings" }
        ]
      });
      await audit({ actorId: user.id, action: "BOOKING_COACH_ABSENT", entityType: "Booking", entityId: id });
      return ok({ success: true, status: "COACH_ABSENT", canRefund: true, canReschedule: true });
    }

    // Case 2: Student absence or cancellation by student
    if (isStudentAbsence || user.id === booking.studentId) {
      if (isStudentAbsence && minutesElapsed < 30) {
        return Response.json({
          error: "El coach debe esperar un lapso no mayor a 30 minutos antes de reportar la inasistencia.",
          action: "WAIT_TOLERANCE"
        }, { status: 422 });
      }

      const studentUser = await prisma.user.findUnique({
        where: { id: booking.studentId },
        select: { id: true, secondChanceUsed: true }
      });

      if (!studentUser?.secondChanceUsed) {
        // 1st offense: Grant 1 Segunda Oportunidad. Strictly NO automatic cash refund.
        await prisma.user.update({
          where: { id: booking.studentId },
          data: { secondChanceUsed: true }
        });
        await prisma.booking.update({
          where: { id },
          data: { status: "CANCELED", canceledAt: new Date() }
        });
        await prisma.notification.createMany({
          data: [
            { userId: booking.studentId, type: "SYSTEM", title: "Segunda oportunidad otorgada", body: "Has registrado una inasistencia o cancelación. Dispones de 1 Segunda Oportunidad para reagendar con el coach sin costo. No aplica reembolso en dinero.", link: "/dashboard/bookings" },
            { userId: booking.coachId, type: "SYSTEM", title: "Inasistencia de estudiante", body: "El estudiante registró inasistencia/cancelación y usó su Segunda Oportunidad para reagendar.", link: "/dashboard/bookings" }
          ]
        });
        await audit({ actorId: user.id, action: "STUDENT_SECOND_CHANCE_GRANTED", entityType: "Booking", entityId: id });
        return ok({
          success: true,
          status: "STUDENT_ABSENT_SECOND_CHANCE_AVAILABLE",
          secondChanceGranted: true,
          canDirectCashRefund: false,
          canRescheduleOnce: true
        });
      } else {
        // 2nd offense: Forfeit funds! No refund, no 3rd chance.
        await prisma.booking.update({
          where: { id },
          data: { status: "NO_SHOW", canceledAt: new Date() }
        });
        await prisma.notification.createMany({
          data: [
            { userId: booking.studentId, type: "SYSTEM", title: "Inasistencia definitiva", body: "Has faltado a tu sesión reagendada. Los fondos han sido retenidos sin derecho a reembolso.", link: "/dashboard/bookings" },
            { userId: booking.coachId, type: "SYSTEM", title: "Sesión finalizada por inasistencia", body: "El estudiante no asistió a su sesión reagendada. Los fondos han sido retenidos.", link: "/dashboard/bookings" }
          ]
        });
        await audit({ actorId: user.id, action: "STUDENT_FUNDS_FORFEITED", entityType: "Booking", entityId: id });
        return ok({
          success: true,
          status: "NO_SHOW",
          secondChanceGranted: false,
          canDirectCashRefund: false,
          canRescheduleOnce: false,
          fundsForfeited: true
        });
      }
    }

    // Case 3: Cancellation initiated by Coach or Admin before start
    if (booking.stripePaymentIntentId && !booking.stripePaymentIntentId.startsWith("mock_") && paymentsMode() === "stripe") {
      await stripe().refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { bookingId: booking.id }
      });
      await prisma.booking.update({ where: { id }, data: { status: "REFUNDED", canceledAt: new Date() } });
    } else {
      await prisma.booking.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date() } });
    }
    await audit({ actorId: user.id, action: "BOOKING_CANCELED", entityType: "Booking", entityId: id });
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
