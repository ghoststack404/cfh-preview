import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

function isCoachNotification(n: { link?: string | null; title: string; body?: string | null }): boolean {
  const link = (n.link || "").toLowerCase();
  const title = (n.title || "").toLowerCase();
  const body = (n.body || "").toLowerCase();

  return (
    link.startsWith("/coach") ||
    link.includes("/coach/") ||
    link.includes("/courses/manage") ||
    link.includes("/dashboard/courses/manage") ||
    link.includes("/dashboard/ai") ||
    link.includes("role=coach") ||
    title.includes("nueva solicitud") ||
    title.includes("solicitud de videollamada") ||
    title.includes("solicitud de apoyo") ||
    title.includes("solicitó una sesión") ||
    title.includes("solicitó apoyo") ||
    title.includes("nueva entrega") ||
    title.includes("entregó la actividad") ||
    title.includes("asistente ia") ||
    title.includes("post-sesión") ||
    title.includes("pago confirmado") ||
    title.includes("nuevo alumno") ||
    title.includes("inscrito a tu curso") ||
    title.includes("compró tu curso") ||
    body.includes("tu alumno") ||
    body.includes("solicitó apoyo en") ||
    (title.includes("en la sala") && !link.includes("role=student"))
  );
}

export async function GET(req: NextRequest) {
  try {
    const user = (await getAuthenticatedUser()) || (await currentUser());
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;
    
    // Verificar si el usuario tiene cuenta de Coach real en DB
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, approvalStatus: true }
    });
    const hasCoachAccount = Boolean(coachProfile || user.role === "COACH");

    // Rol activo efectivo: si no tiene cuenta de coach, su rol es estrictamente STUDENT
    const activeRole = hasCoachAccount && activeRoleCookie === "COACH" ? "COACH" : "STUDENT";
    const isCoach = activeRole === "COACH";

    // Obtener las notificaciones del usuario
    const allNotifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Separar conteos sin mezclar
    const coachNotifs = allNotifications.filter(isCoachNotification);
    const studentNotifs = allNotifications.filter((n) => !isCoachNotification(n));

    const unreadCoachCount = hasCoachAccount ? coachNotifs.filter((n) => !n.readAt).length : 0;
    const unreadStudentCount = studentNotifs.filter((n) => !n.readAt).length;

    // Si el usuario no tiene cuenta de coach, NUNCA mostrar notificaciones de coach
    const filtered = allNotifications.filter((n) => {
      const isCoachN = isCoachNotification(n);
      if (!hasCoachAccount) {
        return !isCoachN;
      }
      if (isCoach) {
        return isCoachN;
      } else {
        return !isCoachN;
      }
    });

    const notifications = filtered
      .filter((n) => (unreadOnly ? !n.readAt : true))
      .slice(0, 50);

    const unreadCount = filtered.filter((n) => !n.readAt).length;

    // Normalizar enlaces para que apunten al destino correcto según el rol activo
    const finalNotifications = notifications.map((n) => {
      let finalLink = n.link;
      if (isCoach && n.link === "/dashboard/bookings") {
        finalLink = "/coach/dashboard#agenda";
      } else if (!isCoach && n.link?.startsWith("/coach/")) {
        finalLink = "/dashboard";
      }
      return {
        ...n,
        link: finalLink,
        roleCategory: isCoachNotification(n) ? "COACH" : "STUDENT",
      };
    });

    return NextResponse.json({
      notifications: finalNotifications,
      unreadCount,
      unreadCoachCount,
      unreadStudentCount,
      isCoachAccount: hasCoachAccount,
      activeRole,
    });
  } catch (error) {
    console.error("Error en api/notifications GET:", error);
    return NextResponse.json(
      { error: "Error al obtener notificaciones" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = (await getAuthenticatedUser()) || (await currentUser());
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id, markAllRead, markRoleRead } = await req.json();

    if (markRoleRead === "COACH" || markRoleRead === "STUDENT") {
      const isCoachRole = markRoleRead === "COACH";
      const userNotifs = await prisma.notification.findMany({
        where: { userId: user.id, readAt: null },
      });
      const idsToMark = userNotifs
        .filter((n) => (isCoachRole ? isCoachNotification(n) : !isCoachNotification(n)))
        .map((n) => n.id);

      if (idsToMark.length > 0) {
        await prisma.notification.updateMany({
          where: { id: { in: idsToMark } },
          data: { readAt: new Date() },
        });
      }
    } else if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (id) {
      await prisma.notification.update({
        where: { id, userId: user.id },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en api/notifications PATCH:", error);
    return NextResponse.json(
      { error: "Error al actualizar notificaciones" },
      { status: 500 }
    );
  }
}
