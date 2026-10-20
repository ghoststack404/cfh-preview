import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { createVideoToken } from "@/lib/video";

const schema = z.object({ bookingId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const input = schema.parse(await request.json());
    const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking || !booking.videoRoomName) throw new Error("NOT_FOUND");
    if (user.role !== "ADMIN" && user.id !== booking.studentId && user.id !== booking.coachId) throw new Error("FORBIDDEN");
    if (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status)) return Response.json({ error: "La sala no está disponible para esta reserva." }, { status: 409 });
    const isDev = process.env.NODE_ENV !== "production";
    const earliest = booking.startAt.getTime() - 30 * 60_000;
    const latest = booking.endAt.getTime() + 4 * 60 * 60_000;
    if (!isDev && (Date.now() < earliest || Date.now() > latest)) {
      return Response.json({ error: "La sala abre 30 minutos antes y cierra cuatro horas después de la sesión." }, { status: 403 });
    }
    const result = createVideoToken(`${user.id}:${user.name}`, booking.videoRoomName);
    return ok({ ...result, roomName: booking.videoRoomName, role: user.id === booking.coachId ? "COACH" : "STUDENT" });
  } catch (error) {
    return handleRouteError(error);
  }
}
