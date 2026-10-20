import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const { conversationId } = await context.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) throw new Error("NOT_FOUND");
    if (conversation.studentId !== user.id && conversation.coachId !== user.id) throw new Error("FORBIDDEN");

    // Marcar como leídos los mensajes que NO sean del usuario actual (fueron enviados por la otra persona)
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
