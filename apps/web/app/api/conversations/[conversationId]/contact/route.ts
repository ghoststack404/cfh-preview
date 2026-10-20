import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { decryptPrivateValue } from "@/lib/security";

export async function GET(_: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await requireUser();
    const { conversationId } = await context.params;
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { student: true, coach: true } });
    if (!conversation || (user.role !== "ADMIN" && user.id !== conversation.studentId && user.id !== conversation.coachId)) throw new Error("NOT_FOUND");
    if (!conversation.contactUnlockedAt && user.role !== "ADMIN") return Response.json({ error: "El contacto se habilita después del pago." }, { status: 403 });
    const other = user.id === conversation.studentId ? conversation.coach : conversation.student;
    let phone: string | null = null;
    if (other.contactPhoneEncrypted) {
      try { phone = decryptPrivateValue(other.contactPhoneEncrypted); } catch { phone = null; }
    }
    return ok({ contact: { name: other.name, email: other.email, phone } });
  } catch (error) {
    return handleRouteError(error);
  }
}
