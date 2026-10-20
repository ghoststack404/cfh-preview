import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSameOrigin, randomToken } from "@/lib/security";

export async function POST(_: Request, context: { params: Promise<{ id: string; lessonId: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["STUDENT"]);
    const { id, lessonId } = await context.params;
    const enrollment = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: id, studentId: user.id } } });
    if (!enrollment || !["ACTIVE", "COMPLETED"].includes(enrollment.status)) throw new Error("FORBIDDEN");
    const lesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, module: { courseId: id } } });
    if (!lesson) throw new Error("NOT_FOUND");

    await prisma.lessonProgress.upsert({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } }, create: { enrollmentId: enrollment.id, lessonId, userId: user.id, completedAt: new Date() }, update: { completedAt: new Date() } });
    const [total, completed] = await Promise.all([
      prisma.courseLesson.count({ where: { module: { courseId: id } } }),
      prisma.lessonProgress.count({ where: { enrollmentId: enrollment.id, completedAt: { not: null } } })
    ]);
    if (total > 0 && completed >= total && enrollment.status !== "COMPLETED") {
      await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED", completedAt: new Date(), certificateCode: `CFH-${randomToken(8).toUpperCase()}` } });
    }
    return ok({ completed, total });
  } catch (error) {
    return handleRouteError(error);
  }
}
