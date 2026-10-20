import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import fs from "fs";
import path from "path";

// Next.js App Router: allow up to 500 MB uploads for video
export const maxDuration = 120; // 2 min timeout

import crypto from "crypto";

const ALLOWED_VIDEO_MIMES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
};

// 500 MB max for video uploads
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const mimeType = (file.type || "").toLowerCase();
    const rawExt = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    let ext = ALLOWED_VIDEO_MIMES[mimeType] || (["mp4", "mov", "webm", "avi", "mkv"].includes(rawExt) ? rawExt : null);

    if (!ext) {
      return NextResponse.json(
        { error: "Formato no soportado. Usa MP4, MOV o WebM." },
        { status: 400 }
      );
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: "El video excede el límite de 500 MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "videos");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/videos/${filename}` });
  } catch (error) {
    console.error("Error al subir video:", error);
    return NextResponse.json({ error: "Error al subir el video" }, { status: 500 });
  }
}

// Allow large payloads for video
export const config = {
  api: {
    bodyParser: false,
  },
};
