"use server";

import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// --- NOTAS ---
export async function getLessonNotes(enrollmentId: string, lessonId: string) {
  const user = await currentUser();
  if (!user) return { error: "No autenticado" };

  const notes = await prisma.lessonNote.findMany({
    where: { enrollmentId, lessonId, userId: user.id },
    orderBy: { createdAt: "desc" }
  });
  return { success: true, notes };
}

export async function createLessonNote(data: { enrollmentId: string; lessonId: string; text: string; seconds: number; timestamp: string; courseId: string; }) {
  const user = await currentUser();
  if (!user) return { error: "No autenticado" };

  const note = await prisma.lessonNote.create({
    data: {
      enrollmentId: data.enrollmentId,
      lessonId: data.lessonId,
      userId: user.id,
      text: data.text,
      seconds: data.seconds,
      timestamp: data.timestamp
    }
  });
  
  revalidatePath(`/classroom/${data.courseId}`);
  return { success: true, note };
}

export async function deleteLessonNote(noteId: string, courseId: string) {
  const user = await currentUser();
  if (!user) return { error: "No autenticado" };

  await prisma.lessonNote.deleteMany({
    where: { id: noteId, userId: user.id }
  });
  
  revalidatePath(`/classroom/${courseId}`);
  return { success: true };
}

// --- Q&A (Preguntas Públicas estilo Udemy) ---
export async function getLessonQuestions(lessonId: string) {
  const questions = await prisma.lessonQuestion.findMany({
    where: { lessonId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      answers: {
        include: { author: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return { success: true, questions };
}

export async function createLessonQuestion(data: { lessonId: string; title: string; body: string; seconds: number; timestamp: string; courseId: string; }) {
  const user = await currentUser();
  if (!user) return { error: "No autenticado" };

  const question = await prisma.lessonQuestion.create({
    data: {
      lessonId: data.lessonId,
      authorId: user.id,
      title: data.title,
      body: data.body,
      seconds: data.seconds,
      timestamp: data.timestamp
    }
  });

  revalidatePath(`/classroom/${data.courseId}`);
  return { success: true, question };
}

export async function createLessonAnswer(data: { questionId: string; body: string; courseId: string; }) {
  const user = await currentUser();
  if (!user) return { error: "No autenticado" };

  const answer = await prisma.lessonAnswer.create({
    data: {
      questionId: data.questionId,
      authorId: user.id,
      body: data.body
    }
  });

  revalidatePath(`/classroom/${data.courseId}`);
  return { success: true, answer };
}
