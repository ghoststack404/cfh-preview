import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { prisma } from "@/lib/db";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
// Use require for pdf-parse to avoid ESM default export issues in Turbopack
// Dynamic require inside the route handler to avoid build crash
import { reportSessionProblem } from "@/app/actions/session";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bookingId = formData.get("bookingId") as string;

    if (!file || !bookingId) {
      return NextResponse.json({ error: "Faltan parÃ¡metros" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El PDF no puede superar los 10MB" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.json({ error: "Booking no encontrado" }, { status: 404 });
    }

    if (booking.coachId !== auth.id) {
      return NextResponse.json({ error: "Solo el coach puede subir materiales" }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extraer texto con pdf-parse
    const pdfParse = require('pdf-parse');
      let extractedText = "";
    try {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } catch (e) {
      console.error("Error extrayendo texto del PDF", e);
      return NextResponse.json({ error: "Error leyendo el contenido del PDF. AsegÃºrate de que no estÃ© encriptado o daÃ±ado." }, { status: 400 });
    }

    // Si el texto es muy largo, cortarlo a unos ~8000 caracteres para evitar altos costos
    const textToAnalyze = extractedText.substring(0, 8000);

    // ModeraciÃ³n con OpenAI
    const prompt = `
Eres el moderador de seguridad de la plataforma "Coaching From Home".
El siguiente texto fue extraÃ­do de un PDF que un Coach intenta compartir con su alumno durante una sesiÃ³n de 60 min.
Debes verificar si el texto contiene intentos de saltarse la plataforma.
EstÃ¡ ESTRICTAMENTE PROHIBIDO:
- Compartir nÃºmeros telefÃ³nicos o WhatsApp.
- Compartir correos electrÃ³nicos personales o de negocios.
- Invitar al alumno a plataformas externas para contacto directo.
- Insultos o contenido inapropiado.

Analiza el texto y responde ÃšNICAMENTE en el siguiente formato JSON:
{
  "approved": boolean,
  "reason": "ExplicaciÃ³n breve de por quÃ© fue aprobado o rechazado"
}

Texto del PDF:
"""
${textToAnalyze}
"""
    `;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const aiResult = JSON.parse(aiResponse.choices?.[0]?.message?.content || "{}");

    if (!aiResult.approved) {
      // Registrar alerta visual para el admin
      await reportSessionProblem(bookingId, `Auto-ModeraciÃ³n de PDF rechazÃ³ archivo del Coach: ${aiResult.reason}`);
      return NextResponse.json({ 
        error: "Archivo rechazado por seguridad", 
        reason: aiResult.reason 
      }, { status: 403 });
    }

    // Subir el archivo localmente para fines de desarrollo. En producciÃ³n, usar S3.
    const publicDir = path.join(process.cwd(), "public", "uploads", "materials");
    await fs.mkdir(publicDir, { recursive: true });

    const fileName = `${bookingId}-${Date.now()}.pdf`;
    const filePath = path.join(publicDir, fileName);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/uploads/materials/${fileName}`;

    return NextResponse.json({ 
      success: true, 
      url: fileUrl, 
      fileName: file.name 
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}



