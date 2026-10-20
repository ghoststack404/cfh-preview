import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const admin = await requireUser(["ADMIN"]);
    const { id } = await context.params;
    const course = await prisma.course.findUnique({ where: { id }, include: { modules: { include: { lessons: true } } } });
    if (!course) throw new Error("NOT_FOUND");
    if (course.status !== "REVIEW") return Response.json({ error: "El curso todavía no fue enviado a revisión." }, { status: 409 });
    if (!course.modules.length || course.modules.some((module) => !module.lessons.length)) return Response.json({ error: "El curso necesita módulos y lecciones antes de publicarse." }, { status: 422 });
    const updated = await prisma.course.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await audit({ actorId: admin.id, action: "COURSE_PUBLISHED", entityType: "Course", entityId: id });
    return ok({ course: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
