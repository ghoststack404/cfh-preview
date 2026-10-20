import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { 
  registerParticipant, 
  addSignalMessage, 
  getSignalsForUser, 
  updateParticipantHeartbeat, 
  removeParticipant,
  admitParticipant
} from "@/lib/video-signaling";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params;
    const user = await currentUser();
    const searchParams = request.nextUrl.searchParams;
    const sinceParam = searchParams.get("since");
    const since = sinceParam ? parseInt(sinceParam, 10) : 0;
    const clientUserId = searchParams.get("userId") || user?.id;

    if (!clientUserId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { messages, participants } = getSignalsForUser(roomId, clientUserId, since);

    return NextResponse.json({
      success: true,
      messages,
      participants,
      serverTime: Date.now(),
    });
  } catch (error) {
    console.error("Error en GET /api/video/signal/[roomId]:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params;
    const user = await currentUser();
    const body = await request.json();

    const senderId = body.senderId || user?.id;
    const senderName = body.senderName || user?.name || "Participante";
    const senderRole = (body.senderRole || user?.role || "STUDENT") as "COACH" | "STUDENT" | "ADMIN";

    if (!senderId) {
      return NextResponse.json({ error: "Identidad no válida" }, { status: 401 });
    }

    const { action } = body;

    if (action === "join") {
      const result = registerParticipant(
        roomId,
        { id: senderId, name: senderName, role: senderRole },
        body.state,
        body.isPreAdmitted
      );
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "signal") {
      const { targetId, type, payload } = body;
      const message = addSignalMessage(roomId, {
        roomId,
        senderId,
        senderName,
        senderRole,
        targetId,
        type,
        payload,
      });
      return NextResponse.json({ success: true, message });
    }

    if (action === "heartbeat") {
      updateParticipantHeartbeat(roomId, senderId, body.state);
      return NextResponse.json({ success: true });
    }

    if (action === "admit") {
      const { targetId } = body;
      if (targetId) {
        admitParticipant(roomId, targetId);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "leave") {
      removeParticipant(roomId, senderId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    console.error("Error en POST /api/video/signal/[roomId]:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
