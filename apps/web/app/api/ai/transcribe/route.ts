import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUser } from "@/app/actions/onboarding";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob;
    
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Convert Blob to a File object that OpenAI expects
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const file = new File([buffer], "chunk.webm", { type: audioFile.type || "audio/webm" });

    // Send to OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "es", // Optimize for Spanish as default, or remove to auto-detect
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Error en la transcripción", details: error.message },
      { status: 500 }
    );
  }
}
