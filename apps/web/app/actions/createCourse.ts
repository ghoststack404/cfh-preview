"use server";

import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";

export async function createCourseDraft(title?: string) {
  const user = await requirePageUser();
  if (!user) {
    throw new Error("No autenticado");
  }
  const slug = crypto.randomUUID();
  const newCourse = await prisma.course.create({
    data: {
      coachId: user.id,
      title: title?.trim() || "Nuevo Curso",
      slug,
      summary: "",
      description: "",
      priceCents: 0,
      currency: "USD",
      status: "DRAFT",
      estimatedMinutes: 0,
    },
    select: { id: true },
  });
  return { id: newCourse.id };
}
