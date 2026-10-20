import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: paramId } = await context.params;

    // Step 1: Resolve Course by CUID or Slug
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { id: paramId },
          { slug: paramId },
        ],
      },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
              include: {
                blocks: {
                  orderBy: { position: "asc" }
                }
              }
            },
          },
        },
      },
    });

    if (!course) throw new Error("NOT_FOUND");

    // Step 2: Validate enrollment using canonical course.id
    const enrollment = await prisma.enrollment.findFirst({
      where: { courseId: course.id, studentId: user.id },
      include: {
        progress: true,
      },
    });

    const isOwnerCoach = course.coachId === user.id;
    const isAdmin = user.role === "ADMIN";
    const isEnrolled = enrollment && ["ACTIVE", "COMPLETED"].includes(enrollment.status);

    if (!isEnrolled && !isAdmin && !isOwnerCoach) {
      throw new Error("FORBIDDEN");
    }

    const completedLessonIds = new Set(
      enrollment?.progress.filter((p) => p.completedAt !== null).map((p) => p.lessonId) || []
    );

    // Map to sections for UI
    const sections = course.modules.map((mod) => {
      const lessons = mod.lessons.map((les) => {
        // Encontrar si hay un bloque de video principal
        const videoBlock = les.blocks.find(b => b.type === "VIDEO");
        
        return {
          id: les.id,
          title: les.title,
          duration: `${les.durationMinutes}:00`,
          completed: completedLessonIds.has(les.id),
          current: false,
          videoUrl: les.videoUrl || (videoBlock ? (videoBlock.data as any).url : null),
          kind: les.kind,
          content: les.content,
          blocks: les.blocks,
        };
      });

      const isModCompleted = lessons.length > 0 && lessons.every((l) => l.completed);

      return {
        id: mod.id,
        title: mod.title,
        completed: isModCompleted,
        lessons,
      };
    });

    const isUnderMaintenance = !!course.description?.includes("[CFH_MAINTENANCE_MODE:true]");

    return ok({ course: { ...course, isUnderMaintenance }, sections, isUnderMaintenance });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: paramId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { lessonId, completed } = body;

    if (!lessonId || typeof lessonId !== "string") {
      return handleRouteError(new Error("BAD_REQUEST"));
    }

    // Step 1: Resolve Course by CUID or Slug
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { id: paramId },
          { slug: paramId },
        ],
      },
      select: { id: true, coachId: true },
    });

    if (!course) throw new Error("NOT_FOUND");

    const enrollment = await prisma.enrollment.findFirst({
      where: { courseId: course.id, studentId: user.id },
    });

    if (!enrollment && user.role !== "ADMIN" && course.coachId !== user.id) {
      throw new Error("FORBIDDEN");
    }

    if (!enrollment) {
      return ok({ success: false, error: "No matriculado" });
    }

    const targetCompleted = completed !== false;

    if (!targetCompleted) {
      await prisma.lessonProgress.deleteMany({
        where: { enrollmentId: enrollment.id, lessonId },
      });
    } else {
      await prisma.lessonProgress.upsert({
        where: {
          enrollmentId_lessonId: {
            enrollmentId: enrollment.id,
            lessonId,
          },
        },
        update: {
          completedAt: new Date(),
        },
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          userId: user.id,
          completedAt: new Date(),
        },
      });
    }

    // Step 4: Recalculate Overall Course Completion Status
    const [totalLessons, completedLessons] = await Promise.all([
      prisma.courseLesson.count({ where: { module: { courseId: course.id } } }),
      prisma.lessonProgress.count({ where: { enrollmentId: enrollment.id, completedAt: { not: null } } }),
    ]);

    const isCourseFinished = totalLessons > 0 && completedLessons >= totalLessons;

    if (isCourseFinished && enrollment.status !== "COMPLETED") {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    } else if (!isCourseFinished && enrollment.status === "COMPLETED") {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "ACTIVE", completedAt: null },
      });
    }

    return ok({ success: true, completed: targetCompleted, completedLessons, totalLessons });
  } catch (error) {
    return handleRouteError(error);
  }
}
