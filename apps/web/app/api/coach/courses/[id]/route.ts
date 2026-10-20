import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { } from "@/lib/course-classroom";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { secureUrlSchema } from "@/lib/validation";
import { moderateCourseContent } from "@/lib/courseModeration";

const lesson = z.object({
  title: z.string().trim().min(3).max(160),
  videoUrl: secureUrlSchema.optional().or(z.literal("")),
  content: z.string().max(20000).optional(),
  durationMinutes: z.number().int().min(1).max(1000),
  isPreview: z.boolean().default(false),
  kind: z.enum(["CONTENT", "ASSIGNMENT", "PROJECT"]).default("CONTENT"),
  
  
  
  
  allowMessages: z.boolean().default(true),
  allowVideoRequests: z.boolean().default(true),
  maxSubmissionFiles: z.number().int().min(1).max(10).default(3)
});
const moduleSchema = z.object({ title: z.string().trim().min(3).max(160), lessons: z.array(lesson).min(1).max(100) });
const schema = z.object({
  title: z.string().trim().min(8).max(160),
  summary: z.string().trim().min(20).max(300),
  description: z.string().trim().min(80).max(10000),
  categoryId: z.string().optional(),
  thumbnailUrl: secureUrlSchema.optional(),
  introVideoUrl: secureUrlSchema.optional(),
  priceCents: z.number().int().min(0).max(5_000_000),
  currency: z.enum(["MXN", "USD", "EUR"]),
  estimatedMinutes: z.number().int().min(15).max(100000),
  certificateEnabled: z.boolean().default(true),
  modules: z.array(moduleSchema).min(1).max(50),
  submitForReview: z.boolean().default(false),
  status: z.enum(["DRAFT", "PUBLISHED", "REVIEW"]).optional()
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["COACH"]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    for (const moduleItem of input.modules) {
      for (const lessonItem of moduleItem.lessons) {
        const settingsError = null;
        if (settingsError) return Response.json({ error: `${lessonItem.title}: ${settingsError}` }, { status: 422 });
      }
    }
    if (input.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
      if (!category) return Response.json({ error: "La categoría seleccionada ya no está disponible." }, { status: 422 });
    }
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course || course.coachId !== user.id) throw new Error("NOT_FOUND");
    if (course.status === "PUBLISHED" || course.status === "ARCHIVED") return Response.json({ error: "Este curso ya no se edita en línea. Crea una nueva versión para proteger el avance de los estudiantes." }, { status: 409 });

    const isPublishing = input.status === "PUBLISHED" || input.submitForReview === true;
    let moderationResult = null;
    if (isPublishing) {
      moderationResult = await moderateCourseContent({
        title: input.title,
        summary: input.summary,
        description: input.description,
        priceCents: input.priceCents,
        currency: input.currency,
        estimatedMinutes: input.estimatedMinutes,
        modules: input.modules,
      });
    }

    if (isPublishing && moderationResult && !moderationResult.allowed) {
      await prisma.$transaction(async (tx) => {
        await tx.courseModule.deleteMany({ where: { courseId: id } });
        await tx.course.update({
          where: { id },
          data: {
            title: input.title,
            summary: input.summary,
            description: input.description,
            categoryId: input.categoryId || null,
            thumbnailUrl: input.thumbnailUrl || null,
            introVideoUrl: input.introVideoUrl || null,
            priceCents: input.priceCents,
            currency: input.currency,
            estimatedMinutes: input.estimatedMinutes,
            certificateEnabled: input.certificateEnabled,
            status: "DRAFT",
            publishedAt: null,
          }
        });
        for (let moduleIndex = 0; moduleIndex < input.modules.length; moduleIndex += 1) {
          const item = input.modules[moduleIndex]!;
          const createdModule = await tx.courseModule.create({ data: { courseId: id, title: item.title, position: moduleIndex + 1 } });
          await tx.courseLesson.createMany({ data: item.lessons.map((lessonItem, lessonIndex) => ({
            moduleId: createdModule.id,
            title: lessonItem.title,
            position: lessonIndex + 1,
            videoUrl: lessonItem.videoUrl || null,
            content: lessonItem.content || null,
            durationMinutes: lessonItem.durationMinutes,
            isPreview: lessonItem.isPreview,
            kind: lessonItem.kind,
            
            
            
            
            allowMessages: lessonItem.allowMessages,
            allowVideoRequests: lessonItem.allowVideoRequests,
            
          })) });
        }
      });

      await audit({
        actorId: user.id,
        action: "COURSE_MODERATION_REJECTED",
        entityType: "Course",
        entityId: id,
        metadata: {
          violations: moderationResult.violations,
          reasons: moderationResult.reasons,
          score: moderationResult.score,
        },
      });

      return Response.json(
        {
          error: "La publicación fue detenida por la moderación con IA. Corrige los problemas indicados.",
          code: "MODERATION_FAILED",
          violations: moderationResult.violations,
          reasons: moderationResult.reasons,
        },
        { status: 422 }
      );
    }

    const nextStatus = isPublishing ? "PUBLISHED" : "DRAFT";
    await prisma.$transaction(async (tx) => {
      await tx.courseModule.deleteMany({ where: { courseId: id } });
      await tx.course.update({
        where: { id },
        data: {
          title: input.title,
          summary: input.summary,
          description: input.description,
          categoryId: input.categoryId || null,
          thumbnailUrl: input.thumbnailUrl || null,
          introVideoUrl: input.introVideoUrl || null,
          priceCents: input.priceCents,
          currency: input.currency,
          estimatedMinutes: input.estimatedMinutes,
          certificateEnabled: input.certificateEnabled,
          status: nextStatus,
          publishedAt: isPublishing ? (course.publishedAt || new Date()) : null,
        }
      });
      for (let moduleIndex = 0; moduleIndex < input.modules.length; moduleIndex += 1) {
        const item = input.modules[moduleIndex]!;
        const createdModule = await tx.courseModule.create({ data: { courseId: id, title: item.title, position: moduleIndex + 1 } });
        await tx.courseLesson.createMany({ data: item.lessons.map((lessonItem, lessonIndex) => ({
          moduleId: createdModule.id,
          title: lessonItem.title,
          position: lessonIndex + 1,
          videoUrl: lessonItem.videoUrl || null,
          content: lessonItem.content || null,
          durationMinutes: lessonItem.durationMinutes,
          isPreview: lessonItem.isPreview,
          kind: lessonItem.kind,
          
          
          
          
          allowMessages: lessonItem.allowMessages,
          allowVideoRequests: lessonItem.allowVideoRequests,
          
        })) });
      }
    });

    if (isPublishing && moderationResult?.allowed) {
      await audit({
        actorId: user.id,
        action: "COURSE_MODERATION_APPROVED",
        entityType: "Course",
        entityId: id,
        metadata: {
          score: moderationResult.score,
          reviewedBy: moderationResult.reviewedBy,
        },
      });
      return ok({ success: true, status: "PUBLISHED", message: "Curso aprobado por IA y publicado directamente." });
    } else {
      await audit({ actorId: user.id, action: "COURSE_UPDATED", entityType: "Course", entityId: id });
      return ok({ success: true, status: "DRAFT" });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
