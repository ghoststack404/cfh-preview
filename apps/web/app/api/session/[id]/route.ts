import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        coach: {
          select: {
            name: true,
            avatarUrl: true,
            coachProfile: { select: { headline: true, currentTier: true } }
          }
        },
        student: { select: { name: true, avatarUrl: true } }
      }
    });

    if (!booking) throw new Error("NOT_FOUND");
    if (booking.studentId !== user.id && booking.coachId !== user.id && user.role !== 'ADMIN') throw new Error("FORBIDDEN");

    return ok({ booking });
  } catch (error) {
    return handleRouteError(error);
  }
}
