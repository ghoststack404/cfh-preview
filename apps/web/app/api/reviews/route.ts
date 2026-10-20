import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { refreshCoachReputation } from "@/lib/coach";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { reviewSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["STUDENT"]);
    const input = reviewSchema.parse(await request.json());
    const booking = await prisma.booking.findUnique({ where: { id: input.bookingId }, include: { review: true } });
    if (!booking || booking.studentId !== user.id) throw new Error("NOT_FOUND");
    if (booking.status !== "COMPLETED") return Response.json({ error: "La reseña se habilita después de completar la sesión." }, { status: 409 });
    if (booking.review) return Response.json({ error: "Esta sesión ya ha sido calificada anteriormente." }, { status: 409 });

    if (booking.isFreeIntro) {
      const priorFreeIntroReview = await prisma.review.findFirst({
        where: {
          authorId: user.id,
          coachId: booking.coachId,
          booking: { isFreeIntro: true }
        }
      });
      if (priorFreeIntroReview) {
        return Response.json({ error: "Las llamadas de prueba solo se pueden calificar una sola vez por coach." }, { status: 409 });
      }
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentReview = await prisma.review.findFirst({
        where: {
          authorId: user.id,
          coachId: booking.coachId,
          createdAt: { gte: thirtyDaysAgo }
        }
      });
      if (recentReview) {
        return Response.json({ error: "Solo puedes evaluar a este coach una vez cada mes para evitar calificaciones repetitivas." }, { status: 409 });
      }
    }

    const review = await prisma.review.create({ data: { bookingId: booking.id, authorId: user.id, coachId: booking.coachId, rating: input.rating, comment: input.comment || null } });
    await refreshCoachReputation(booking.coachId);
    await audit({ actorId: user.id, action: "REVIEW_CREATED", entityType: "Review", entityId: review.id, metadata: { rating: review.rating } });
    return ok({ review }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
