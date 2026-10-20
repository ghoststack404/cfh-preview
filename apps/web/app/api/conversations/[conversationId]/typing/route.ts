import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { triggerPusherSafe } from "@/lib/pusher-server";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireUser();
    const { conversationId } = await context.params;

    // Verificar que el usuario pertenece a la conversación
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { studentId: true, coachId: true },
    });

    if (!conversation) {
      return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    if (conversation.studentId !== user.id && conversation.coachId !== user.id && user.role !== "ADMIN") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    await triggerPusherSafe(`conversation-${conversationId}`, "user-typing", {
      userId: user.id,
      userName: user.name,
    });

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
