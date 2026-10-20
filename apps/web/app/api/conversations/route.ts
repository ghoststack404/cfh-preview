import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { cookies } from "next/headers";
import { triggerPusherSafe } from "@/lib/pusher-server";

export async function GET() {
  try {
    const user = await requireUser();

    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;
    const activeRole = activeRoleCookie || user.role;
    const isCoach = activeRole === "COACH";

    const whereClause = isCoach ? { coachId: user.id } : { studentId: user.id };

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
          },
        },
        coach: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
            coachProfile: {
              select: {
                headline: true,
                slug: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
    });

    const formatted = conversations.map((conv) => {
      const isStudentRole = !isCoach;
      const otherUser = isStudentRole ? conv.coach : conv.student;
      const otherUserHeadline = isStudentRole ? conv.coach.coachProfile?.headline || "Coach" : "Aprendiz";
      const lastMsg = conv.messages[0] || null;
      const isBotPendingHuman = Boolean(
        lastMsg &&
        (lastMsg.content.includes("Esa información no la tengo a la mano") ||
         lastMsg.content.includes("[Pendiente de respuesta humana / Derivado de Bot]"))
      );

      return {
        id: conv.id,
        studentId: conv.studentId,
        coachId: conv.coachId,
        lastMessageAt: conv.lastMessageAt || conv.createdAt,
        createdAt: conv.createdAt,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          avatarUrl: otherUser.avatarUrl,
          headline: otherUserHeadline,
        },
        lastMessage: lastMsg,
        isBotPendingHuman,
      };
    });

    return ok({ conversations: formatted });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const body = await request.json();
    const { coachId, initialMessage } = body;

    if (!coachId) {
      return Response.json({ error: "coachId es requerido" }, { status: 400 });
    }

    // Resolve coach User.id: coachId could be either User.id or CoachProfile.id
    let targetCoachUserId = coachId;
    const coachProfile = await prisma.coachProfile.findFirst({
      where: {
        OR: [
          { id: coachId },
          { userId: coachId },
          { slug: coachId },
        ],
      },
      select: { userId: true },
    });

    if (coachProfile) {
      targetCoachUserId = coachProfile.userId;
    }

    if (targetCoachUserId === user.id) {
      return Response.json({ error: "No puedes iniciar una conversación contigo mismo" }, { status: 400 });
    }

    // Si el usuario es un estudiante (no admin ni el coach), debe haber pagado una sesión o curso
    if (user.role !== "ADMIN" && user.id !== targetCoachUserId) {
      const hasPaidBooking = await prisma.booking.findFirst({
        where: {
          studentId: user.id,
          coachId: targetCoachUserId,
          isFreeIntro: false,
          status: {
            in: ["CONFIRMED", "COMPLETED", "IN_PROGRESS"],
          },
        },
      });

      const hasPaidCourse = await prisma.enrollment.findFirst({
        where: {
          studentId: user.id,
          status: {
            in: ["ACTIVE", "COMPLETED"],
          },
          course: {
            coachId: targetCoachUserId,
          },
        },
      });

      if (!hasPaidBooking && !hasPaidCourse) {
        return Response.json(
          {
            error: "Para enviar mensajes directos a este coach, primero debes reservar una clase pagada o adquirir uno de sus cursos.",
          },
          { status: 403 }
        );
      }
    }

    // Find existing conversation without booking
    let conversation = await prisma.conversation.findFirst({
      where: {
        studentId: user.id,
        coachId: targetCoachUserId,
      },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            coachProfile: { select: { headline: true } },
          },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          studentId: user.id,
          coachId: targetCoachUserId,
          lastMessageAt: new Date(),
        },
        include: {
          coach: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              coachProfile: { select: { headline: true } },
            },
          },
        },
      });
    }

    // If an initial message was provided, create it
    if (initialMessage && initialMessage.trim()) {
      const createdMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: initialMessage.trim(),
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: createdMessage.createdAt },
      });

      // Send in-app notification to coach
      await prisma.notification.create({
        data: {
          userId: targetCoachUserId,
          type: "MESSAGE",
          title: `Nuevo mensaje de ${user.name}`,
          body: initialMessage.trim().slice(0, 120),
          link: `/messages?conversationId=${conversation.id}`,
        },
      });

      // Broadcast real-time Pusher events
      const messagePayload = {
        id: createdMessage.id,
        conversationId: conversation.id,
        senderId: user.id,
        content: createdMessage.content,
        createdAt: createdMessage.createdAt.toISOString(),
        sender: {
          id: user.id,
          name: user.name || "Usuario",
          avatarUrl: user.avatarUrl || null,
        },
      };
      await triggerPusherSafe(`conversation-${conversation.id}`, "new-message", messagePayload);
      await triggerPusherSafe(`private-conversation-${conversation.id}`, "new-message", messagePayload);
      await triggerPusherSafe(`user-${targetCoachUserId}`, "conversation-updated", {
        conversationId: conversation.id,
        lastMessage: {
          id: createdMessage.id,
          content: createdMessage.content,
          createdAt: createdMessage.createdAt.toISOString(),
          senderId: user.id,
        },
        lastMessageAt: createdMessage.createdAt.toISOString(),
      });
      await triggerPusherSafe(`user-${user.id}`, "conversation-updated", {
        conversationId: conversation.id,
        lastMessage: {
          id: createdMessage.id,
          content: createdMessage.content,
          createdAt: createdMessage.createdAt.toISOString(),
          senderId: user.id,
        },
        lastMessageAt: createdMessage.createdAt.toISOString(),
      });
      await triggerPusherSafe(`private-user-${targetCoachUserId}`, "conversation-updated", {
        conversationId: conversation.id,
        lastMessage: {
          id: createdMessage.id,
          content: createdMessage.content,
          createdAt: createdMessage.createdAt.toISOString(),
          senderId: user.id,
        },
        lastMessageAt: createdMessage.createdAt.toISOString(),
      });
      await triggerPusherSafe(`private-user-${user.id}`, "conversation-updated", {
        conversationId: conversation.id,
        lastMessage: {
          id: createdMessage.id,
          content: createdMessage.content,
          createdAt: createdMessage.createdAt.toISOString(),
          senderId: user.id,
        },
        lastMessageAt: createdMessage.createdAt.toISOString(),
      });

      // FASE 4: Auto-responder inteligente del Coach para el primer mensaje
      try {
        const { processCoachAiAutoReply } = await import("@/app/actions/ai-bot");
        await processCoachAiAutoReply({
          conversationId: conversation.id,
          coachId: targetCoachUserId,
          studentId: user.id,
          incomingText: initialMessage.trim(),
        });
      } catch (botErr) {
        console.warn("[conversations/route] Error ejecutando auto-responder del Coach:", botErr);
      }
    }

    return ok({ conversation }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
