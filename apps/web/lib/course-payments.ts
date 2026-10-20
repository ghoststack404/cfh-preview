import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type TransactionClient = Prisma.TransactionClient;

async function updateEnrollmentCount(client: TransactionClient, courseId: string) {
  const count = await client.enrollment.count({ where: { courseId, status: { in: ["ACTIVE", "COMPLETED"] } } });
  await client.course.update({ where: { id: courseId }, data: { enrollmentCount: count } });
}

export async function activateCourseEnrollment(input: {
  enrollmentId: string;
  checkoutSessionId: string;
  paymentIntentId?: string | null;
  tx?: TransactionClient;
}) {
  async function run(client: TransactionClient) {
    const current = await client.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: { course: { select: { id: true, title: true, coachId: true } } },
    });
    if (!current) return null;
    const enrollment = await client.enrollment.update({
      where: { id: input.enrollmentId },
      data: {
        status: "ACTIVE",
        enrolledAt: current.enrolledAt ?? new Date(),
        leftAt: null,
        stripeCheckoutSessionId: input.checkoutSessionId,
        stripePaymentIntentId: input.paymentIntentId ?? current.stripePaymentIntentId
      }
    });
    await updateEnrollmentCount(client, current.courseId);

    // Notificación para el aprendiz — confirmación de compra
    const courseTitle = current.course?.title ?? "el curso";
    await client.notification.createMany({
      data: [
        {
          userId: current.studentId,
          type: "SYSTEM",
          title: "Compra exitosa",
          body: `Tu acceso a "${courseTitle}" está activo. Puedes comenzar a aprender ahora.`,
          link: `/dashboard`,
        },
        {
          userId: current.course.coachId,
          type: "SYSTEM",
          title: "Nuevo alumno inscrito",
          body: `Un estudiante se ha inscrito en tu curso "${courseTitle}".`,
          link: `/coach/cursos`,
        },
      ],
      skipDuplicates: true,
    });

    return enrollment;
  }

  if (input.tx) return run(input.tx);
  return prisma.$transaction((tx) => run(tx));
}

export async function syncCourseEnrollmentCount(courseId: string, tx?: TransactionClient) {
  if (tx) return updateEnrollmentCount(tx, courseId);
  return prisma.$transaction((client) => updateEnrollmentCount(client, courseId));
}
