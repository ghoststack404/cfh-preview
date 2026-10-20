import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    
    const authHeader = request.headers.get("authorization");
    const bearerSecret = authHeader?.split(" ")[1];

    const expectedSecret = env().CRON_SECRET || process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 500 });
    }

    if (secret !== expectedSecret && bearerSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calcula hace 30 minutos de tolerancia
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Encuentra las sesiones cuyo startAt sea menor a hace 30 minutos
    // y su estado no sea completado, cancelado, refundado, etc.
    const expiredBookings = await prisma.booking.findMany({
      where: {
        startAt: {
          lt: thirtyMinutesAgo,
        },
        status: {
          notIn: ["COMPLETED", "CANCELED", "REFUNDED", "DISPUTED", "NO_SHOW"],
        },
      },
      include: {
        student: {
          select: { id: true, secondChanceUsed: true },
        },
      },
    });

    let updatedCount = 0;
    for (const b of expiredBookings) {
      if (!b.student.secondChanceUsed) {
        // Primera falta del alumno: Otorgar 1 Segunda Oportunidad (reagendamiento sin reembolso en dinero)
        await prisma.user.update({
          where: { id: b.studentId },
          data: { secondChanceUsed: true },
        });
        await prisma.booking.update({
          where: { id: b.id },
          data: { status: "CANCELED" },
        });
        await prisma.notification.createMany({
          data: [
            {
              userId: b.studentId,
              type: "SYSTEM",
              title: "Segunda oportunidad otorgada",
              body: "Se detectó inasistencia en tu sesión. Cuentas con 1 Segunda Oportunidad para reagendar con el coach.",
              link: "/dashboard/bookings",
            },
            {
              userId: b.coachId,
              type: "SYSTEM",
              title: "Inasistencia registrada tras 30 min",
              body: "La sesión no se llevó a cabo tras los 30 minutos de espera.",
              link: "/dashboard/bookings",
            },
          ],
        });
      } else {
        // Segunda falta del alumno: Retención definitiva de fondos (NO_SHOW)
        await prisma.booking.update({
          where: { id: b.id },
          data: { status: "NO_SHOW" },
        });
        await prisma.notification.createMany({
          data: [
            {
              userId: b.studentId,
              type: "SYSTEM",
              title: "Inasistencia definitiva",
              body: "Has faltado a tu sesión reagendada. Los fondos han sido retenidos por política de CFH.",
              link: "/dashboard/bookings",
            },
            {
              userId: b.coachId,
              type: "SYSTEM",
              title: "Sesión finalizada por inasistencia",
              body: "El estudiante faltó a su sesión reagendada. Los fondos han sido retenidos.",
              link: "/dashboard/bookings",
            },
          ],
        });
      }
      updatedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount,
      message: `Procesadas ${updatedCount} sesiones con política de ausencias.`
    });

  } catch (error) {
    console.error("Cron error marking absences:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
