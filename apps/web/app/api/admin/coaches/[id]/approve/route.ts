import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendMailSafely } from "@/lib/mail";
import { assertSameOrigin } from "@/lib/security";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const admin = await requireUser(["ADMIN"]);
    const { id } = await context.params;
    const coach = await prisma.user.findUnique({ where: { id }, include: { coachProfile: true } });
    if (!coach?.coachProfile) throw new Error("NOT_FOUND");
    const profile = await prisma.coachProfile.update({ where: { userId: id }, data: { approvalStatus: "APPROVED", rejectionReason: null, verifiedAt: new Date() } });
    await audit({ actorId: admin.id, action: "COACH_APPROVED", entityType: "CoachProfile", entityId: profile.id });
    await sendMailSafely({ to: coach.email, subject: "Tu perfil fue aprobado", text: "Tu perfil ya puede aparecer en Coaching From Home." }, "el aviso de aprobación");
    return ok({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
