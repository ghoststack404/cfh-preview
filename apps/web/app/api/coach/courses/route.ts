import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { slugify } from "@/lib/slug";
import { secureUrlSchema } from "@/lib/validation";
import { checkFeatureAccess } from "@/lib/subscription-gating";
import { moderateCourseContent } from "@/lib/courseModeration";

const lessonSchema = z.object({
  title: z.string().trim().min(3).max(160),
  durationMinutes: z.number().int().min(1).default(10),
  videoUrl: secureUrlSchema.optional().or(z.literal("")),
  content: z.string().max(20000).optional(),
});

const moduleSchema = z.object({
  title: z.string().trim().min(3).max(160),
  lessons: z.array(lessonSchema).optional().default([]),
});

const schema = z.object({
  title: z.string().trim().min(8).max(160),
  summary: z.string().trim().min(20).max(300),
  description: z.string().trim().min(80).max(10000),
  categoryId: z.string().optional(),
  thumbnailUrl: secureUrlSchema.optional(),
  introVideoUrl: secureUrlSchema.optional(),
  priceCents: z.number().int().min(0).max(5_000_000),
  currency: z.enum(["MXN", "USD", "EUR"]).default("MXN"),
  estimatedMinutes: z.number().int().min(15).max(100000).default(60),
  certificateEnabled: z.boolean().default(true),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT").optional(),
  modules: z.array(moduleSchema).optional(),
});

export async function GET() {
  try {
    const user = await requireUser(["COACH"]);
    return ok({ courses: await prisma.course.findMany({ where: { coachId: user.id }, include: { modules: { include: { lessons: true } } }, orderBy: { createdAt: "desc" } }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["COACH"]);

    const hasAccess = await checkFeatureAccess(user.id, "hasCourseBuilder");
    if (!hasAccess) {
      return Response.json(
        { error: "Tu plan actual no permite esta función.", code: "FEATURE_LOCKED" },
        { status: 403 }
      );
    }

    const input = schema.parse(await request.json());
    if (input.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
      if (!category) return Response.json({ error: "La categoría seleccionada ya no está disponible." }, { status: 422 });
    }

    const isPublishing = input.status === "PUBLISHED";
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
      const course = await prisma.course.create({
        data: {
          coachId: user.id,
          categoryId: input.categoryId || null,
          title: input.title,
          slug: `${slugify(input.title)}-${crypto.randomUUID().slice(0, 6)}`,
          summary: input.summary,
          description: input.description,
          thumbnailUrl: input.thumbnailUrl || null,
          introVideoUrl: input.introVideoUrl || null,
          priceCents: input.priceCents,
          currency: input.currency,
          estimatedMinutes: input.estimatedMinutes,
          certificateEnabled: input.certificateEnabled,
          status: "DRAFT",
          publishedAt: null,
        },
      });

      await audit({
        actorId: user.id,
        action: "COURSE_MODERATION_REJECTED",
        entityType: "Course",
        entityId: course.id,
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
          course,
        },
        { status: 422 }
      );
    }

    const courseStatus = isPublishing ? "PUBLISHED" : "DRAFT";
    const course = await prisma.course.create({
      data: {
        coachId: user.id,
        categoryId: input.categoryId || null,
        title: input.title,
        slug: `${slugify(input.title)}-${crypto.randomUUID().slice(0, 6)}`,
        summary: input.summary,
        description: input.description,
        thumbnailUrl: input.thumbnailUrl || null,
        introVideoUrl: input.introVideoUrl || null,
        priceCents: input.priceCents,
        currency: input.currency,
        estimatedMinutes: input.estimatedMinutes,
        certificateEnabled: input.certificateEnabled,
        status: courseStatus,
        publishedAt: isPublishing ? new Date() : null,
      },
    });

    if (input.modules && input.modules.length > 0) {
      for (let mi = 0; mi < input.modules.length; mi++) {
        const item = input.modules[mi]!;
        const createdModule = await prisma.courseModule.create({
          data: { courseId: course.id, title: item.title, position: mi + 1 },
        });
        if (item.lessons && item.lessons.length > 0) {
          await prisma.courseLesson.createMany({
            data: item.lessons.map((lessonItem, lessonIndex) => ({
              moduleId: createdModule.id,
              title: lessonItem.title,
              position: lessonIndex + 1,
              videoUrl: lessonItem.videoUrl || null,
              content: lessonItem.content || null,
              durationMinutes: lessonItem.durationMinutes,
            })),
          });
        }
      }
    }

    if (isPublishing && moderationResult?.allowed) {
      await audit({
        actorId: user.id,
        action: "COURSE_MODERATION_APPROVED",
        entityType: "Course",
        entityId: course.id,
        metadata: {
          score: moderationResult.score,
          reviewedBy: moderationResult.reviewedBy,
        },
      });
    } else {
      await audit({ actorId: user.id, action: "COURSE_CREATED", entityType: "Course", entityId: course.id });
    }

    return ok({ course, status: courseStatus }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

