import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getCourseParticipantAccess } from "@/lib/course-access";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ content: z.string().trim().min(2).max(3000), enrollmentId: z.string().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string; lessonId: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const { id, lessonId } = await context.params;
    const input = schema.parse(await request.json());
    let enrollmentId = input.enrollmentId;
    if (user.role === "STUDENT") {
      const enrollment = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: id, studentId: user.id } }, select: { id: true } });
      enrollmentId = enrollment?.id;
    }
    if (!enrollmentId) throw new Error("NOT_FOUND");
    const access = await getCourseParticipantAccess(user, enrollmentId, lessonId);
    if (!access || access.enrollment.courseId !== id || !access.lesson.allowMessages) throw new Error("NOT_FOUND");
    const message = await prisma.lessonMessage.create({ data: { enrollmentId, lessonId, authorId: user.id, content: input.content } });
    const recipientId = access.isStudent ? access.enrollment.course.coachId : access.enrollment.studentId;
    await prisma.notification.create({ data: { userId: recipientId, type: "MESSAGE", title: "Nuevo mensaje en una actividad", body: `${user.name}: ${input.content.slice(0, 120)}`, link: access.isStudent ? `/dashboard/courses/manage/${id}` : `/dashboard/courses/learn/${id}/lessons/${lessonId}` } });
    await audit({ actorId: user.id, action: "LESSON_MESSAGE_SENT", entityType: "LessonMessage", entityId: message.id, metadata: { courseId: id, lessonId, enrollmentId } });
    return ok({ message }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
