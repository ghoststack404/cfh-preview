import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/x-pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/x-png": "png",
  "image/webp": "png",
};

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado para subir certificados. Inicia sesión." },
        { status: 401 }
      );
    }

    const data = await request.formData();
    const file = data.get("file") as unknown as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo no debe superar los 15 MB." },
        { status: 400 }
      );
    }

    const rawExt = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const mimeType = (file.type || "").toLowerCase();

    let targetExt = "pdf";
    if (rawExt === "pdf" || mimeType.includes("pdf")) {
      targetExt = "pdf";
    } else if (rawExt === "jpg" || rawExt === "jpeg" || mimeType.includes("jpeg") || mimeType.includes("jpg")) {
      targetExt = "jpg";
    } else if (rawExt === "png" || mimeType.includes("png")) {
      targetExt = "png";
    } else if (rawExt === "webp" || mimeType.includes("webp")) {
      targetExt = "png";
    } else if (ALLOWED_EXTENSIONS.includes(rawExt)) {
      targetExt = rawExt === "jpeg" ? "jpg" : rawExt;
    } else {
      return NextResponse.json(
        { error: "Formato no permitido. Solo se aceptan archivos PDF, JPG o PNG." },
        { status: 400 }
      );
    }

    const fileType = targetExt;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `cert-${user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${fileType}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "certificates");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, buffer);

    const fileUrl = `/uploads/certificates/${filename}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: file.name,
      fileType: fileType.toUpperCase(),
      fileSize: file.size,
    });
  } catch (error: any) {
    console.error("[/api/coach/certificates/upload] Error:", error);
    return NextResponse.json(
      { error: "Ocurrió un error inesperado al subir el certificado." },
      { status: 500 }
    );
  }
}
