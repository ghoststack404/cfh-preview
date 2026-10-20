import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { prisma } from "@/lib/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { transcript, bookingId } = body;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Eres un 'Copiloto IA' experto para un Coach. 
Recibirás una transcripción cruda de una videollamada entre un Coach y su Alumno.
Debes analizarla y devolver un objeto JSON estricto con esta estructura:
{
  "summary": "Resumen ejecutivo de 2 a 3 párrafos de lo que se habló en la sesión.",
  "strengths": ["Punto fuerte 1", "Punto fuerte 2"],
  "improvements": ["Área a mejorar 1"],
  "tasks": ["Tarea 1 para el alumno", "Tarea 2"]
}
El tono debe ser profesional, constructivo y redactado como si lo escribiera el Coach para el Alumno.`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.7,
    });

    const aiResponse = completion.choices?.[0]?.message?.content || "";
    if (!aiResponse) throw new Error("No response from OpenAI");

    const parsedData = JSON.parse(aiResponse);

    if (bookingId) {
      const formattedNotes = `# Resumen de la Sesión (IA)\n\n${parsedData.summary}\n\n## Puntos Fuertes\n${parsedData.strengths.map((s: string) => "- " + s).join('\n')}\n\n## Áreas de Mejora\n${parsedData.improvements.map((s: string) => "- " + s).join('\n')}\n\n## Tareas Asignadas\n${parsedData.tasks.map((s: string) => "- " + s).join('\n')}`;
      
      await prisma.booking.update({
        where: { id: bookingId },
        data: { notes: formattedNotes }
      });
    }

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Error generando el resumen", details: error.message },
      { status: 500 }
    );
  }
}
