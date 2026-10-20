import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbUsers = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        role: true,
        avatarUrl: true,
        coachProfile: { select: { photoUrl: true, headline: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const activeMembers = dbUsers.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      headline:
        u.coachProfile?.headline ||
        (u.role === "COACH" ? "Coach CFH" : u.role === "ADMIN" ? "Equipo CFH" : "Aprendiz CFH"),
      avatarUrl: u.coachProfile?.photoUrl || u.avatarUrl,
      isOnline: false,
      statusText: "Desconectado",
    }));

    return NextResponse.json({
      success: true,
      activeMembers,
      onlineCount: 0,
      offlineCount: activeMembers.length,
      totalCount: activeMembers.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, activeMembers: [] }, { status: 500 });
  }
}

// POST endpoint retained as harmless 200 OK for any external callers
export async function POST() {
  return NextResponse.json({ success: true, message: "Heartbeat migrated to WebSockets" });
}
