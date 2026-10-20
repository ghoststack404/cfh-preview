import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { } from "@/lib/course-classroom";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  content: z.string().max(20000),
  kind: z.enum(["CONTENT", "ASSIGNMENT", "PROJECT"]),
  
  
  
  
  allowMessages: z.boolean(),
  allowVideoRequests: z.boolean(),
  maxSubmissionFiles: z.number().int().min(1).max(10)
});

export async function PUT(request: Request, context: { params: Promise<{ id: string; lessonId: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["COACH"]);
    const { id, lessonId } = await context.params;
    const input = schema.parse(await request.json());
    const settingsError = null;
    if (settingsError) return Response.json({ error: settingsError }, { status: 422 });
    const lesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, module: { courseId: id, course: { coachId: user.id } } } });
    if (!lesson) throw new Error("NOT_FOUND");
    const updated = await prisma.courseLesson.update({ where: { id: lessonId }, data: input });
    await audit({ actorId: user.id, action: "COURSE_ACTIVITY_SETTINGS_UPDATED", entityType: "CourseLesson", entityId: lessonId, metadata: { courseId: id } });
    return ok({ lesson: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
