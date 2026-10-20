import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendMailSafely } from "@/lib/mail";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ reason: z.string().trim().min(10).max(1000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const admin = await requireUser(["ADMIN"]);
    const input = schema.parse(await request.json());
    const { id } = await context.params;
    const coach = await prisma.user.findUnique({ where: { id }, include: { coachProfile: true } });
    if (!coach?.coachProfile) throw new Error("NOT_FOUND");
    const profile = await prisma.coachProfile.update({ where: { userId: id }, data: { approvalStatus: "REJECTED", rejectionReason: input.reason, verifiedAt: null } });
    await audit({ actorId: admin.id, action: "COACH_REJECTED", entityType: "CoachProfile", entityId: profile.id, metadata: { reason: input.reason } });
    await sendMailSafely({ to: coach.email, subject: "Revisión de tu perfil", text: `Necesitamos que ajustes lo siguiente: ${input.reason}` }, "el aviso de revisión");
    return ok({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
