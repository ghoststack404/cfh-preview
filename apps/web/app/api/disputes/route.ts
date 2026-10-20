import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ bookingId: z.string().min(1), reason: z.string().trim().min(5).max(120), details: z.string().trim().min(20).max(5000) });

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["STUDENT"]);
    const input = schema.parse(await request.json());
    const booking = await prisma.booking.findUnique({ where: { id: input.bookingId }, include: { dispute: true } });
    if (!booking || booking.studentId !== user.id) throw new Error("NOT_FOUND");
    if (booking.isFreeIntro || booking.priceCents === 0) return Response.json({ error: "La mediación de pago aplica a sesiones pagadas." }, { status: 409 });
    if (!(["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status))) return Response.json({ error: "Esta reserva no puede abrir una disputa." }, { status: 409 });
    if (booking.dispute) return Response.json({ error: "Ya existe una disputa para esta sesión." }, { status: 409 });
    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({ data: { bookingId: booking.id, studentId: booking.studentId, coachId: booking.coachId, reason: input.reason, details: input.details } });
      await tx.booking.update({ where: { id: booking.id }, data: { status: "DISPUTED" } });
      return created;
    });
    await audit({ actorId: user.id, action: "DISPUTE_OPENED", entityType: "Dispute", entityId: dispute.id });
    return ok({ dispute }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
