import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadToCloudinary = (buffer: Buffer, resourceType: "image" | "video" | "auto" = "auto"): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'tia_monica_uploads', resource_type: resourceType },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ALLOWED_VIDEO_MIME_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "mp4",
};

const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WebP: RIFF ... WEBP (52 49 46 46)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado para subir archivos" }, { status: 401 });
    }

    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const url = new URL(request.url);
    const uploadType = url.searchParams.get("type");
    const isCourseUpload = uploadType === "course";
    const isVideoRequest = uploadType === "video";

    const rawExt = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const mimeType = (file.type || "").toLowerCase();
    const normalizedExt = rawExt === "jpeg" ? "jpg" : rawExt;

    const isVideo =
      isVideoRequest ||
      ALLOWED_VIDEO_EXTENSIONS.includes(normalizedExt) ||
      Boolean(ALLOWED_VIDEO_MIME_TYPES[mimeType]) ||
      mimeType.startsWith("video/");

    const isImage =
      !isVideo &&
      ALLOWED_IMAGE_EXTENSIONS.includes(normalizedExt) &&
      Boolean(ALLOWED_IMAGE_MIME_TYPES[mimeType]);

    if (isVideo) {
      if (
        !ALLOWED_VIDEO_EXTENSIONS.includes(normalizedExt) ||
        (!ALLOWED_VIDEO_MIME_TYPES[mimeType] && !mimeType.startsWith("video/") && mimeType !== "")
      ) {
        return NextResponse.json(
          { error: "Formato no permitido. Solo se aceptan videos en formato MP4, WebM o MOV." },
          { status: 400 }
        );
      }
    } else if (!isImage) {
      return NextResponse.json(
        { error: "Formato no permitido. Solo se aceptan imágenes JPG, PNG o WebP." },
        { status: 400 }
      );
    }

    const maxAllowedSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxAllowedSize) {
      return NextResponse.json(
        {
          error: isVideo
            ? "El video excede el límite máximo de 100 MB."
            : "La imagen excede el límite máximo de 5 MB.",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > maxAllowedSize) {
      return NextResponse.json(
        {
          error: isVideo
            ? "El video excede el límite de 100 MB."
            : "La imagen excede el límite de 5 MB.",
        },
        { status: 400 }
      );
    }

    if (isImage && !isValidImageBuffer(buffer)) {
      return NextResponse.json(
        { error: "El archivo no corresponde a una imagen válida o está dañado." },
        { status: 400 }
      );
    }

    const fileType = isVideo
      ? ALLOWED_VIDEO_MIME_TYPES[mimeType] || normalizedExt || "mp4"
      : ALLOWED_IMAGE_MIME_TYPES[mimeType] || normalizedExt;

    if (isImage && !isCourseUpload) {
      // Moderación estricta de imágenes (IA Vision + Heurística de Seguridad)
      // Solo para uploads de comunidad (fotos de perfil, posts, etc.)
      const { moderateImageBuffer } = await import("@/lib/imageModeration");
      const { checkAndHandleCommunityStrike, checkAndAutoReactivateUser } = await import("@/lib/communityStrikes");

      // Verificar si el usuario está suspendido
      const reactivateCheck = await checkAndAutoReactivateUser(user.id);
      if (reactivateCheck.isSuspended) {
        return NextResponse.json(
          {
            error: `Tu cuenta está suspendida. Podrás volver a participar en ${reactivateCheck.remainingText}.`,
            isSuspended: true,
          },
          { status: 403 }
        );
      }

      const modResult = await moderateImageBuffer(buffer, mimeType);
      if (!modResult.isSafe) {
        const detailSnippet = modResult.extractedText
          ? `[Archivo: ${file.name || "imagen"} | Texto detectado: "${modResult.extractedText.slice(0, 100)}"]`
          : `[Archivo: ${file.name || "imagen"}]`;
        const strikeResult = await checkAndHandleCommunityStrike(
          user.id,
          modResult.reason || "Imagen con contenido inapropiado o datos restringidos",
          detailSnippet
        );
        return NextResponse.json(
          {
            error: strikeResult.warningMessage,
            isSuspended: strikeResult.isSuspended,
          },
          { status: 400 }
        );
      }
    }

    if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const result = await uploadToCloudinary(buffer, isVideo ? "video" : "image");
        return NextResponse.json({ url: result.secure_url });
      } catch (cloudErr) {
        console.error("Cloudinary upload failed:", cloudErr);
        // Let it fall back to local upload if Cloudinary fails (e.g. invalid keys)
      }
    }

    // Fallback: Local file system (for development)
    const filename = `${user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${fileType}`;
    
    // Asegurar guardado en el directorio correcto de Next.js (apps/web/public/uploads y/o public/uploads)
    const targetDirs = [
      path.join(process.cwd(), "public", "uploads"),
    ];
    if (fs.existsSync(path.join(process.cwd(), "apps", "web", "public"))) {
      targetDirs.push(path.join(process.cwd(), "apps", "web", "public", "uploads"));
    }

    for (const dir of targetDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(path.join(dir, filename), buffer);
      } catch (err) {
        console.error(`Error guardando en ${dir}:`, err);
      }
    }

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error("Error al subir archivo:", error);
    return NextResponse.json({ error: "Ocurrió un error al subir el archivo" }, { status: 500 });
  }
}
