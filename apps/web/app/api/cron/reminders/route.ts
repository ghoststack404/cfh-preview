import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMailSafely } from "@/lib/mail";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!env().CRON_SECRET || authorization !== `Bearer ${env().CRON_SECRET}`) return Response.json({ error: "No autorizado." }, { status: 401 });
  const from = new Date(Date.now() + 23.5 * 60 * 60_000);
  const to = new Date(Date.now() + 24.5 * 60 * 60_000);
  const bookings = await prisma.booking.findMany({ where: { status: "CONFIRMED", reminder24hSentAt: null, startAt: { gte: from, lt: to } }, include: { student: true, coach: true } });
  let processed = 0;
  let emailFailures = 0;
  for (const booking of bookings) {
    const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeStyle: "short" }).format(booking.startAt);
    const deliveries = await Promise.all([
      sendMailSafely({ to: booking.student.email, subject: "Tu sesión es mañana", text: `Tu sesión con ${booking.coach.name} será ${date}. Entra desde tu panel.` }, "el recordatorio del estudiante"),
      sendMailSafely({ to: booking.coach.email, subject: "Tienes una sesión mañana", text: `Tu sesión con ${booking.student.name} será ${date}. Entra desde tu panel.` }, "el recordatorio del coach")
    ]);
    emailFailures += deliveries.filter((delivery) => !delivery.ok).length;
    await prisma.$transaction([
      prisma.notification.createMany({ data: [
        { userId: booking.studentId, type: "BOOKING", title: "Tu sesión es mañana", body: `Sesión con ${booking.coach.name}: ${date}`, link: "/dashboard/bookings" },
        { userId: booking.coachId, type: "BOOKING", title: "Tienes una sesión mañana", body: `Sesión con ${booking.student.name}: ${date}`, link: "/dashboard/bookings" }
      ] }),
      prisma.booking.updateMany({ where: { id: booking.id, reminder24hSentAt: null }, data: { reminder24hSentAt: new Date() } })
    ]);
    processed += 1;
  }
  await Promise.all([
    prisma.booking.updateMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(Date.now() - 60 * 60_000) } }, data: { status: "CANCELED", canceledAt: new Date() } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(Date.now() - 86_400_000) } }, { usedAt: { not: null } }] } })
  ]);
  return Response.json({ processed, emailFailures });
}
