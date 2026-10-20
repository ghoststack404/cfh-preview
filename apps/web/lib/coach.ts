import { prisma } from "@/lib/db";
import { calculateCoachLevel } from "@/lib/business";

export async function refreshCoachReputation(coachId: string) {
  const [ratings, completedSessionCount] = await Promise.all([
    prisma.review.aggregate({
      where: { coachId, isVisible: true },
      _avg: { rating: true },
      _count: { rating: true }
    }),
    prisma.booking.count({ where: { coachId, status: "COMPLETED" } })
  ]);
  const averageRating = ratings._avg.rating ?? 0;
  const reviewCount = ratings._count.rating;
  const level = calculateCoachLevel({ averageRating, reviewCount, completedSessionCount });
  return prisma.coachProfile.update({
    where: { userId: coachId },
    data: { averageRating, reviewCount, completedSessionCount, level }
  });
}
