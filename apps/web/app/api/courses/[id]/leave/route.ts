import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { syncCourseEnrollmentCount } from "@/lib/course-payments";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  acknowledged: z.literal(true),
  reason: z.string().trim().max(500).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["STUDENT"]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const enrollment = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: id, studentId: user.id } } });
    if (!enrollment || !["ACTIVE", "COMPLETED"].includes(enrollment.status)) throw new Error("NOT_FOUND");
    await prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "WITHDRAWN", leftAt: new Date(), noRefundAcknowledgedAt: new Date(), leaveReason: input.reason || null }
      });
      await syncCourseEnrollmentCount(id, tx);
    });
    await audit({ actorId: user.id, action: "COURSE_LEFT_NO_REFUND", entityType: "Enrollment", entityId: enrollment.id, metadata: { courseId: id } });
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
