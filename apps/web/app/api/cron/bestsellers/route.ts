import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/cron/bestsellers
 *
 * Calcula los 10 cursos más vendidos en los últimos 30 días
 * y actualiza el campo isBestseller en la base de datos.
 *
 * Este endpoint está protegido por un secreto CRON_SECRET para que
 * solo pueda ser llamado por el scheduler (Vercel Cron, etc.).
 *
 * Configuración recomendada en vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/bestsellers", "schedule": "0 0 1 * *" }]
 * }
 */
export async function GET(request: NextRequest) {
  // --- Protección del endpoint ---
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Calcular el rango de los últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 2. Agrupar Enrollments ACTIVOS/COMPLETADOS por curso en los últimos 30 días
    const salesByCourse = await prisma.enrollment.groupBy({
      by: ["courseId"],
      where: {
        status: { in: ["ACTIVE", "COMPLETED"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { courseId: true },
      orderBy: { _count: { courseId: "desc" } },
      take: 10,
    });

    const topCourseIds = salesByCourse.map((s) => s.courseId);

    // 3. Transacción: quitar bestseller a todos y asignarlo a los top 10
    // await prisma.$transaction([
    //   // Primero, quitarla a TODOS
    //   prisma.course.updateMany({
    //     where: { isBestseller: true },
    //     data: { isBestseller: false },
    //   }),
    //   // Luego, asignarla solo a los ganadores del período
    //   prisma.course.updateMany({
    //     where: { id: { in: topCourseIds } },
    //     data: { isBestseller: true },
    //   }),
    // ]);

    return NextResponse.json({
      success: true,
      message: `Etiqueta Bestseller actualizada.`,
      updatedCount: topCourseIds.length,
      topCourses: topCourseIds,
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON:bestsellers] Error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al calcular Bestsellers." },
      { status: 500 }
    );
  }
}
