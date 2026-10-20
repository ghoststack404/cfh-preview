"use server";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import type { CourseStatus, LessonKind } from "@prisma/client";

// Obtener curso completo para el editor
export async function getCourseForEditor(courseId: string) {
  const user = await requirePageUser();
  if (!user) throw new Error("No autenticado");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      category: { select: { id: true, name: true } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: {
              id: true, title: true, position: true, kind: true,
              videoUrl: true, content: true, durationMinutes: true, isPreview: true,
            },
          },
        },
      },
    },
  });

  if (!course || course.coachId !== user.id) throw new Error("Curso no encontrado");
  return course;
}

// Guardar datos generales del curso
export async function updateCourseGeneral(input: {
  courseId: string;
  title: string;
  summary: string;
  description: string;
  priceCents: number;
  currency: string;
  categoryId?: string | null;
  thumbnailUrl?: string | null;
  introVideoUrl?: string | null;
  status: CourseStatus;
  estimatedMinutes?: number;
}) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const course = await prisma.course.findUnique({ where: { id: input.courseId }, select: { coachId: true } });
    if (!course || course.coachId !== user.id) return { success: false, error: "No autorizado" };

    await prisma.course.update({
      where: { id: input.courseId },
      data: {
        title: (input.title || "").trim() || "Nuevo Curso",
        summary: (input.summary || "").trim(),
        description: (input.description || "").trim(),
        priceCents: Math.max(0, input.priceCents || 0),
        currency: "USD",
        categoryId: input.categoryId || null,
        thumbnailUrl: input.thumbnailUrl || null,
        introVideoUrl: input.introVideoUrl || null,
        status: input.status,
        estimatedMinutes: Math.max(0, Number(input.estimatedMinutes) || 0),
        publishedAt: input.status === "PUBLISHED" ? new Date() : undefined,
      },
    });
    return { success: true };
  } catch (e: unknown) {
    console.error("[updateCourseGeneral] Error al guardar:", e);
    const msg = e instanceof Error ? e.message : "Error desconocido al guardar";
    return { success: false, error: msg };
  }
}

// Upsert módulo (crear o actualizar)
export async function upsertModule(input: {
  courseId: string;
  moduleId?: string;
  title: string;
  position: number;
  description?: string;
}) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const course = await prisma.course.findUnique({ where: { id: input.courseId }, select: { coachId: true } });
    if (!course || course.coachId !== user.id) return { success: false, error: "No autorizado" };

    if (input.moduleId) {
      const mod = await prisma.courseModule.update({
        where: { id: input.moduleId },
        data: { title: input.title.trim(), position: input.position, description: input.description },
      });
      return { success: true, module: mod };
    } else {
      // Calcular posición si no se provee
      const count = await prisma.courseModule.count({ where: { courseId: input.courseId } });
      const mod = await prisma.courseModule.create({
        data: {
          courseId: input.courseId,
          title: input.title.trim(),
          position: input.position ?? count + 1,
          description: input.description,
        },
      });
      return { success: true, module: mod };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, error: msg };
  }
}

// Eliminar módulo
export async function deleteModule(moduleId: string) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const mod = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: { select: { coachId: true } } },
    });
    if (!mod || mod.course.coachId !== user.id) return { success: false, error: "No autorizado" };
    await prisma.courseModule.delete({ where: { id: moduleId } });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, error: msg };
  }
}

// Upsert lección
export async function upsertLesson(input: {
  moduleId: string;
  lessonId?: string;
  title: string;
  position: number;
  kind?: LessonKind;
  videoUrl?: string | null;
  content?: string | null;
  durationMinutes?: number;
  isPreview?: boolean;
}) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const mod = await prisma.courseModule.findUnique({
      where: { id: input.moduleId },
      include: { course: { select: { coachId: true } } },
    });
    if (!mod || mod.course.coachId !== user.id) return { success: false, error: "No autorizado" };

    const data = {
      title: input.title.trim(),
      position: input.position,
      kind: input.kind ?? ("CONTENT" as LessonKind),
      videoUrl: input.videoUrl || null,
      content: input.content || null,
      durationMinutes: input.durationMinutes ?? 10,
      isPreview: input.isPreview ?? false,
    };

    if (input.lessonId) {
      const lesson = await prisma.courseLesson.update({ where: { id: input.lessonId }, data });
      return { success: true, lesson };
    } else {
      const count = await prisma.courseLesson.count({ where: { moduleId: input.moduleId } });
      const lesson = await prisma.courseLesson.create({
        data: { moduleId: input.moduleId, ...data, position: data.position ?? count + 1 },
      });
      return { success: true, lesson };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, error: msg };
  }
}

// Obtener categorías disponibles
export async function getCategories() {
  return prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// Eliminar lección
export async function deleteLesson(lessonId: string) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const lesson = await prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: { select: { coachId: true } } } } },
    });
    if (!lesson || lesson.module.course.coachId !== user.id) return { success: false, error: "No autorizado" };
    await prisma.courseLesson.delete({ where: { id: lessonId } });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, error: msg };
  }
}
