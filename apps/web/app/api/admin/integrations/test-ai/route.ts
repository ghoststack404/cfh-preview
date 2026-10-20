import { requireUser } from "@/lib/auth";
import { generateAiArtifact } from "@/lib/ai";
import { handleRouteError } from "@/lib/api";
import { assertSameOrigin } from "@/lib/security";

export async function POST() {
  try {
    await assertSameOrigin();
    await requireUser(["ADMIN"]);
    const result = await generateAiArtifact({
      type: "AUTO_REPLY",
      role: "ADMIN",
      prompt: "Quiero organizar mis metas profesionales y saber si una sesión inicial puede ayudarme."
    });
    return Response.json({
      message: `${result.provider === "openai" ? "OpenAI real" : "Generador local"} respondió con ${result.content.length} caracteres usando ${result.model}.`
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
