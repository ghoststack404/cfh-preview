
"use server";

import { prisma } from "database";
import { currentUser } from "@/lib/auth";
import { UserRole } from "database";

export async function getCoachEarnings(period: string = "30d") {
  try {
    const user = await currentUser();
    if (!user || user.role !== UserRole.COACH) {
      return { success: false, error: "No autorizado" };
    }

    const startDate = new Date();
    if (period === "7d") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "30d") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === "90d") {
      startDate.setDate(startDate.getDate() - 90);
    } else if (period === "all") {
      startDate.setFullYear(2000);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }

    // Ganancias por Cursos
    const courseEnrollments = await prisma.enrollment.findMany({
      where: {
        course: { coachId: user.id },
        status: "ACTIVE", // Asumiendo ACTIVE = pagado
        enrolledAt: { gte: startDate }
      }
    });

    let courseEarningsCents = 0;
    courseEnrollments.forEach((e: any) => {
      courseEarningsCents += (e.priceCents - e.platformFeeCents);
    });

    // Ganancias por Sesiones
    const bookings = await prisma.booking.findMany({
      where: {
        coachId: user.id,
        status: { in: ["CONFIRMED", "COMPLETED"] },
        createdAt: { gte: startDate }
      }
    });

    let sessionEarningsCents = 0;
    bookings.forEach((b: any) => {
      sessionEarningsCents += (b.priceCents - b.platformFeeCents);
    });

    // Obtener comision del plan actual
    const sub = await prisma.coachSubscription.findFirst({
      where: { coachId: user.id, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { createdAt: "desc" }
    });

    let commissionBps = 2000; // default 20%
    if (sub && sub.plan) {
      commissionBps = sub.plan.commissionBps;
    } else {
      const basic = await prisma.subscriptionPlan.findUnique({ where: { tier: "BASIC" } });
      if (basic) commissionBps = basic.commissionBps;
    }

    return {
      success: true,
      sessionEarnings: sessionEarningsCents / 100,
      courseEarnings: courseEarningsCents / 100,
      totalEarnings: (sessionEarningsCents + courseEarningsCents) / 100,
      sessionCount: bookings.length,
      courseCount: courseEnrollments.length,
      commissionPct: commissionBps / 100,
      currency: "MXN"
    };

  } catch (error) {
    return { success: false, error: "Error interno" };
  }
}

