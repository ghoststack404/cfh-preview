import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createCertificatePdf } from "@/lib/pdf";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const enrollment = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: id, studentId: user.id } }, include: { course: { include: { coach: true } }, student: true } });
    if (!enrollment || enrollment.status !== "COMPLETED" || !enrollment.certificateCode) throw new Error("NOT_FOUND");
    const dateStr = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(enrollment.completedAt ?? new Date());
    const pdf = await createCertificatePdf(
      enrollment.student.name ?? "Estudiante",
      enrollment.course.title,
      enrollment.course.coach.name ?? "Coach",
      dateStr,
      enrollment.certificateCode
    );
    return new Response(pdf as any, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="cfh-${enrollment.id}-certificate.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}
