import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher-server";
import { currentUser } from "@/lib/auth";
import { getAuthenticatedUser } from "@/app/actions/onboarding";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Extract socket_id and channel_name supporting both form-data and json
    const contentType = req.headers.get("content-type") || "";
    let socketId = "";
    let channelName = "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      socketId = body.socket_id;
      channelName = body.channel_name;
    } else {
      const formData = await req.formData().catch(() => new FormData());
      socketId = (formData.get("socket_id") as string) || "";
      channelName = (formData.get("channel_name") as string) || "";
    }

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: "Missing socket_id or channel_name" },
        { status: 400 }
      );
    }

    // 2. Authenticate current user session
    const user = (await currentUser()) || (await getAuthenticatedUser());
    if (!user || !user.id || (user as any).status === "SUSPENDED") {
      return NextResponse.json(
        { error: "PRESENCE_AUTH_REQUIRED: Debes iniciar sesión" },
        { status: 401 }
      );
    }

    // 3. Handle Presence Channel: presence-community
    if (channelName.startsWith("presence-")) {
      const role = user.role || "STUDENT";
      const headline =
        (user as any).coachProfile?.headline ||
        (role === "COACH" ? "Coach CFH" : role === "ADMIN" ? "Equipo CFH" : "Aprendiz CFH");
      const avatarUrl =
        (user as any).coachProfile?.photoUrl || user.avatarUrl || null;

      const presenceData = {
        user_id: user.id,
        user_info: {
          id: user.id,
          name: user.name || "Usuario",
          avatarUrl,
          role,
          headline,
        },
      };

      const authResponse = pusherServer.authorizeChannel(
        socketId,
        channelName,
        presenceData
      );

      return NextResponse.json(authResponse);
    }

    // 4. Handle Private Channels: private-conversation-* or private-user-*
    if (channelName.startsWith("private-")) {
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    return NextResponse.json(
      { error: "Invalid channel authorization request" },
      { status: 403 }
    );
  } catch (error) {
    console.error("[Pusher Auth Route Error]:", error);
    return NextResponse.json(
      { error: "Internal server error during authorization" },
      { status: 500 }
    );
  }
}
