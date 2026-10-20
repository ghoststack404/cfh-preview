import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { contactMessage, findContactData } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { messageSchema } from "@/lib/validation";
import { triggerPusherSafe } from "@/lib/pusher-server";
import { checkAndHandleCommunityStrike } from "@/lib/communityStrikes";

async function accessibleConversation(id: string, userId: string, isAdmin: boolean) {
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) throw new Error("NOT_FOUND");
  if (!isAdmin && conversation.studentId !== userId && conversation.coachId !== userId) throw new Error("FORBIDDEN");
  return conversation;
}

export async function GET(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await requireUser();
    const { conversationId } = await context.params;
    await accessibleConversation(conversationId, user.id, user.role === "ADMIN");
    
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const queryOptions: any = {
      where: { conversationId },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // saltar el cursor en sí
    }

    const messagesDesc = await prisma.message.findMany(queryOptions);
    
    // Marcar como leídos los mensajes recibidos en esta conversación
    const updatedMessages = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    if (updatedMessages.count > 0) {
      await triggerPusherSafe(`conversation-${conversationId}`, "messages-read", {
        readBy: user.id,
        readAt: new Date().toISOString(),
      });
    }

    // Marcar como leídas las notificaciones asociadas a este chat para el usuario actual
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        link: { contains: conversationId },
      },
      data: { readAt: new Date() },
    });

    // Devolver en orden ascendente para el cliente de chat
    const messages = messagesDesc.reverse();
    
    const nextCursor = messagesDesc.length === limit ? messagesDesc[messagesDesc.length - 1]?.id : null;

    return ok({ messages, nextCursor });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const { conversationId } = await context.params;
    const conversation = await accessibleConversation(conversationId, user.id, user.role === "ADMIN");
    const input = messageSchema.parse(await request.json());
    if (!conversation.contactUnlockedAt && user.role !== "ADMIN") {
      const findings = findContactData(input.content);
      if (findings.length) {
        const labels: Record<string, string> = {
          email: "correo electrónico",
          phone: "número de teléfono o texto numérico",
          link: "enlace externo",
          social: "red social",
        };
        const violationDesc = findings.map((item) => labels[item] || item).join(", ");
        
        // Registrar infracción con el sistema oficial de Strikes de la plataforma
        const strikeResult = await checkAndHandleCommunityStrike(
          user.id,
          `Intento de compartir datos de contacto en chat (${violationDesc})`,
          input.content
        );

        return Response.json(
          {
            error: strikeResult.warningMessage,
            strikeNumber: strikeResult.strikeNumber,
            isSuspended: strikeResult.isSuspended,
            findings,
          },
          { status: 422 }
        );
      }
    }
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({ data: { conversationId, senderId: user.id, content: input.content } });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt } });
      const recipientId = user.id === conversation.studentId ? conversation.coachId : conversation.studentId;
      const targetRole = user.id === conversation.studentId ? "coach" : "student";
      await tx.notification.create({ data: { userId: recipientId, type: "MESSAGE", title: `Nuevo mensaje de ${user.name}`, body: input.content.slice(0, 120), link: `/messages?conversationId=${conversationId}&role=${targetRole}` } });
      return created;
    });

    const recipientId = user.id === conversation.studentId ? conversation.coachId : conversation.studentId;

    // 1. Broadcast new message event to active chat participants
    const messagePayload = {
      id: message.id,
      conversationId,
      senderId: user.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: user.id,
        name: user.name || "Usuario",
        avatarUrl: user.avatarUrl || null,
      },
    };
    await triggerPusherSafe(`conversation-${conversationId}`, "new-message", messagePayload);
    await triggerPusherSafe(`private-conversation-${conversationId}`, "new-message", messagePayload);

    // 2. Broadcast conversation update event to recipient and sender sidebars
    const conversationUpdatePayload = {
      conversationId,
      lastMessage: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        senderId: user.id,
      },
      lastMessageAt: message.createdAt.toISOString(),
    };
    await triggerPusherSafe(`user-${recipientId}`, "conversation-updated", conversationUpdatePayload);
    await triggerPusherSafe(`user-${user.id}`, "conversation-updated", conversationUpdatePayload);
    await triggerPusherSafe(`private-user-${recipientId}`, "conversation-updated", conversationUpdatePayload);
    await triggerPusherSafe(`private-user-${user.id}`, "conversation-updated", conversationUpdatePayload);

    // FASE 4: Auto-responder inteligente del Coach (Asistente Virtual IA)
    // Si el remitente es el alumno, verificar si el coach tiene bot activo para responder automáticamente
    if (user.id === conversation.studentId) {
      try {
        const { processCoachAiAutoReply } = await import("@/app/actions/ai-bot");
        const botResult = await processCoachAiAutoReply({
          conversationId,
          coachId: conversation.coachId,
          studentId: conversation.studentId,
          incomingText: input.content,
        });

        if (botResult?.replied && botResult.messageId) {
          const botPayload = {
            id: botResult.messageId,
            conversationId,
            senderId: conversation.coachId,
            content: botResult.replyText || "",
            createdAt: new Date().toISOString(),
            sender: {
              id: conversation.coachId,
              name: "Asistente Virtual",
              avatarUrl: null,
            },
          };
          await triggerPusherSafe(`conversation-${conversationId}`, "new-message", botPayload);
          await triggerPusherSafe(`private-conversation-${conversationId}`, "new-message", botPayload);
          await triggerPusherSafe(`user-${conversation.studentId}`, "conversation-updated", {
            conversationId,
            lastMessage: {
              id: botResult.messageId,
              content: botResult.replyText || "",
              createdAt: botPayload.createdAt,
              senderId: conversation.coachId,
            },
            lastMessageAt: botPayload.createdAt,
          });
        }
      } catch (botErr) {
        console.warn("[messages/route] Error ejecutando auto-responder del Coach:", botErr);
      }
    }

    return ok({ message }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
