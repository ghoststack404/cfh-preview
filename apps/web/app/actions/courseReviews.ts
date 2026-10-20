"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function submitCourseReview(courseId: string, rating: number, comment?: string) {
  try {
    const user = await currentUser();
    if (!user) {
      return { success: false, error: "Debes iniciar sesiA3n para calificar" };
    }

    if (!rating || rating < 1 || rating > 5) {
      return { success: false, error: "La calificaciA3n debe ser de 1 a 5 estrellas" };
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        reviews: {
          where: { studentId: user.id }
        }
      }
    });

    if (!course) {
      return { success: false, error: "Curso no encontrado" };
    }

    const existingReview = course.reviews[0];

    if (existingReview) {
      if (comment !== undefined || rating) {
        await prisma.courseReview.update({
          where: { id: existingReview.id },
          data: {
            rating,
            comment: comment?.trim() || existingReview.comment,
          }
        });
        await refreshCourseReputation(course.id);
      }
      return { success: true, reviewId: existingReview.id };
    }

    const review = await prisma.courseReview.create({
      data: {
        courseId: course.id,
        studentId: user.id,
        rating,
        comment: comment?.trim() || null,
        isVisible: true
      }
    });

    await refreshCourseReputation(course.id);

    revalidatePath(`/cursos/${course.id}`);
    revalidatePath(`/classroom/${course.id}`);

    return { success: true, reviewId: review.id };
  } catch (error) {
    console.error("Error en submitCourseReview:", error);
    return { success: false, error: "Error al registrar la reseAa" };
  }
}

export async function refreshCourseReputation(courseId: string) {
  const ratings = await prisma.courseReview.aggregate({
    where: { courseId, isVisible: true },
    _avg: { rating: true },
    _count: { rating: true }
  });
  const averageRating = ratings._avg.rating ?? 0;
  
  return prisma.course.update({
    where: { id: courseId },
    data: { averageRating }
  });
}
