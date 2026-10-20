import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { paymentsMode, stripe } from "@/lib/payments";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ resolution: z.enum(["REFUND", "RELEASE"]), note: z.string().trim().min(10).max(3000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const admin = await requireUser(["ADMIN"]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const dispute = await prisma.dispute.findUnique({ where: { id }, include: { booking: true } });
    if (!dispute) throw new Error("NOT_FOUND");
    if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) return Response.json({ error: "Esta disputa ya fue resuelta." }, { status: 409 });
    if (input.resolution === "REFUND" && dispute.booking.stripePaymentIntentId && !dispute.booking.stripePaymentIntentId.startsWith("mock_") && paymentsMode() === "stripe") {
      await stripe().refunds.create({ payment_intent: dispute.booking.stripePaymentIntentId, reverse_transfer: true, refund_application_fee: true, metadata: { disputeId: dispute.id, bookingId: dispute.bookingId } });
    }
    await prisma.$transaction([
      prisma.dispute.update({ where: { id }, data: { status: input.resolution === "REFUND" ? "RESOLVED_REFUND" : "RESOLVED_RELEASE", resolutionNote: input.note } }),
      prisma.booking.update({ where: { id: dispute.bookingId }, data: { status: input.resolution === "REFUND" ? "REFUNDED" : "COMPLETED", completedAt: input.resolution === "RELEASE" ? new Date() : undefined } }),
      prisma.notification.createMany({ data: [
        { userId: dispute.studentId, type: "PAYMENT", title: "Disputa resuelta", body: input.note, link: "/dashboard/bookings" },
        { userId: dispute.coachId, type: "PAYMENT", title: "Disputa resuelta", body: input.note, link: "/dashboard/bookings" }
      ] })
    ]);
    await audit({ actorId: admin.id, action: `DISPUTE_${input.resolution}`, entityType: "Dispute", entityId: id });
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
