import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export const activeEnrollmentStatuses = ["ACTIVE", "COMPLETED"] as const;

export async function getStudentLessonAccess(userId: string, courseId: string, lessonId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId: userId } },
    include: {
      course: { include: { coach: true } },
      progress: { where: { lessonId } },
      
      discussionMessages: { where: { lessonId }, include: { author: { select: { id: true, name: true, role: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } },
      
    }
  });
  if (!enrollment || !activeEnrollmentStatuses.includes(enrollment.status as (typeof activeEnrollmentStatuses)[number])) return null;
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    include: { module: true }
  });
  if (!lesson) return null;
  return { enrollment, lesson };
}

export async function getCourseParticipantAccess(user: { id: string; role: UserRole }, enrollmentId: string, lessonId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: true }
  });
  if (!enrollment || !activeEnrollmentStatuses.includes(enrollment.status as (typeof activeEnrollmentStatuses)[number])) return null;
  const lesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, module: { courseId: enrollment.courseId } } });
  if (!lesson) return null;
  const isStudent = user.role === "STUDENT" && enrollment.studentId === user.id;
  const isCoach = user.role === "COACH" && enrollment.course.coachId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isStudent && !isCoach && !isAdmin) return null;
  return { enrollment, lesson, isStudent, isCoach, isAdmin };
}

export function lessonKindLabel(kind: "CONTENT" | "ASSIGNMENT" | "PROJECT") {
  if (kind === "ASSIGNMENT") return "Actividad";
  if (kind === "PROJECT") return "Proyecto";
  return "Lección";
}
