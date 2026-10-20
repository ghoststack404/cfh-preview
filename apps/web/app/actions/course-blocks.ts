"use server";

import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import DOMPurify from "isomorphic-dompurify";
import type { BlockType } from "@prisma/client";

export async function getLessonBlocks(lessonId: string) {
  const user = await requirePageUser();
  if (!user) throw new Error("No autenticado");

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      blocks: {
        orderBy: { position: "asc" },
      },
      module: {
        include: {
          course: {
            select: { coachId: true },
          },
        },
      },
    },
  });

  if (!lesson || lesson.module.course.coachId !== user.id) {
    throw new Error("Lección no encontrada o no autorizado");
  }

  return lesson;
}

export async function updateLessonMetadata(
  lessonId: string,
  data: {
    title: string;
    durationMinutes: number;
    isPreview: boolean;
    learningObjectives: string[];
  }
) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const lesson = await prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: { select: { coachId: true } } } } },
    });
    if (!lesson || lesson.module.course.coachId !== user.id) {
      return { success: false, error: "No autorizado" };
    }

    const updated = await prisma.courseLesson.update({
      where: { id: lessonId },
      data: {
        title: data.title,
        durationMinutes: data.durationMinutes,
        isPreview: data.isPreview,
        content: JSON.stringify(data.learningObjectives),
      },
    });
    return { success: true, lesson: updated };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function upsertLessonBlock(
  lessonId: string,
  blockId: string | null,
  type: BlockType,
  data: any,
  position: number
) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const lesson = await prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: { select: { coachId: true } } } } },
    });
    if (!lesson || lesson.module.course.coachId !== user.id) {
      return { success: false, error: "No autorizado" };
    }

    // Sanitizar si es TEXT
    let processedData = data;
    if (type === "TEXT" && data?.html) {
      processedData = { ...data, html: DOMPurify.sanitize(data.html) };
    }

    if (blockId) {
      const block = await prisma.courseLessonBlock.update({
        where: { id: blockId },
        data: { type, data: processedData, position },
      });
      return { success: true, block };
    } else {
      const block = await prisma.courseLessonBlock.create({
        data: { lessonId, type, data: processedData, position },
      });
      return { success: true, block };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteLessonBlock(blockId: string) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const block = await prisma.courseLessonBlock.findUnique({
      where: { id: blockId },
      include: {
        lesson: {
          include: { module: { include: { course: { select: { coachId: true } } } } },
        },
      },
    });
    if (!block || block.lesson.module.course.coachId !== user.id) {
      return { success: false, error: "No autorizado" };
    }

    await prisma.courseLessonBlock.delete({ where: { id: blockId } });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function reorderLessonBlocks(lessonId: string, blockIds: string[]) {
  const user = await requirePageUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const lesson = await prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: { select: { coachId: true } } } } },
    });
    if (!lesson || lesson.module.course.coachId !== user.id) {
      return { success: false, error: "No autorizado" };
    }

    await prisma.$transaction(
      blockIds.map((id, index) =>
        prisma.courseLessonBlock.update({
          where: { id },
          data: { position: index },
        })
      )
    );
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
