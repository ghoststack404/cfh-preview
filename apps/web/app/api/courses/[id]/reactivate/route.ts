import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { syncCourseEnrollmentCount } from "@/lib/course-payments";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["STUDENT"]);
    const { id } = await context.params;
    const enrollment = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: id, studentId: user.id } } });
    if (!enrollment || enrollment.status !== "WITHDRAWN" || !enrollment.stripePaymentIntentId) throw new Error("NOT_FOUND");
    await prisma.$transaction(async (tx) => {
      await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "ACTIVE", leftAt: null, leaveReason: null } });
      await syncCourseEnrollmentCount(id, tx);
    });
    await audit({ actorId: user.id, action: "COURSE_REACTIVATED", entityType: "Enrollment", entityId: enrollment.id, metadata: { courseId: id } });
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
