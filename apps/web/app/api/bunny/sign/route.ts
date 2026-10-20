import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { title } = await request.json();
    
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    const pullZone = process.env.BUNNY_STREAM_PULL_ZONE;

    if (!libraryId || !apiKey || !pullZone) {
      return NextResponse.json({ error: "Bunny.net no está configurado" }, { status: 500 });
    }

    // 1. Create the video object in Bunny
    const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: "POST",
      headers: {
        "AccessKey": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: title || "Video" }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("Bunny create video failed:", err);
      return NextResponse.json({ error: "Fallo al crear video en Bunny" }, { status: 500 });
    }

    const videoData = await createRes.json();
    const videoId = videoData.guid;

    // 2. Generate TUS Signature
    const expire = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiration
    const stringToSign = `${libraryId}${apiKey}${expire}${videoId}`;
    const signature = crypto.createHash("sha256").update(stringToSign).digest("hex");

    return NextResponse.json({
      signature,
      expire,
      libraryId,
      videoId,
      pullZone
    });
  } catch (error) {
    console.error("Error en /api/bunny/sign:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
