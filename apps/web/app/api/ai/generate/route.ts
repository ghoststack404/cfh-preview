import { requireUser } from "@/lib/auth";
import { generateAiArtifact } from "@/lib/ai";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { aiSchema } from "@/lib/validation";

const coachTypes = new Set(["TASK_PLAN", "SESSION_SUMMARY", "EMOTIONAL_INSIGHTS", "MARKETING_POST", "AUTO_REPLY"]);
const studentTypes = new Set(["TASK_PLAN", "STUDY_PLAN"]);

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const input = aiSchema.parse(await request.json());
    if (user.role === "STUDENT" && !studentTypes.has(input.type)) throw new Error("FORBIDDEN");
    if (user.role === "COACH" && !coachTypes.has(input.type)) throw new Error("FORBIDDEN");
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    let limit = user.role === "COACH" ? 5 : 10;
    if (user.role === "COACH") {
      const subscription = await prisma.coachSubscription.findFirst({ where: { coachId: user.id, status: { in: ["ACTIVE", "TRIALING"] } }, include: { plan: true }, orderBy: { createdAt: "desc" } });
      if (subscription) limit = subscription.plan.monthlyAiCredits;
    }
    const used = await prisma.aiArtifact.count({ where: { userId: user.id, createdAt: { gte: monthStart } } });
    if (user.role !== "ADMIN" && used >= limit) return Response.json({ error: `Ya usaste los ${limit} resultados de IA disponibles este mes.` }, { status: 429 });
    const result = await generateAiArtifact({ type: input.type, prompt: input.prompt, role: user.role });
    const title = {
      TASK_PLAN: "Plan de tareas",
      STUDY_PLAN: "Plan de estudio",
      SESSION_SUMMARY: "Resumen de sesión",
      EMOTIONAL_INSIGHTS: "Observaciones emocionales",
      MARKETING_POST: "Publicación sugerida",
      AUTO_REPLY: "Respuesta sugerida"
    }[input.type];
    const artifact = await prisma.aiArtifact.create({ data: { userId: user.id, type: input.type, title, prompt: input.prompt, content: result.content, provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens } });
    await audit({ actorId: user.id, action: "AI_ARTIFACT_CREATED", entityType: "AiArtifact", entityId: artifact.id, metadata: { type: artifact.type, provider: artifact.provider } });
    return ok({ artifact: { id: artifact.id, title: artifact.title, content: artifact.content, provider: artifact.provider, model: artifact.model }, usage: { used: used + 1, limit } }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
