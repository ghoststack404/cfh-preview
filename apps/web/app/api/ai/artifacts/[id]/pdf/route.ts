import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createTextPdf } from "@/lib/pdf";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const artifact = await prisma.aiArtifact.findUnique({ where: { id } });
    if (!artifact || (artifact.userId !== user.id && user.role !== "ADMIN")) throw new Error("NOT_FOUND");
    const pdf = await createTextPdf(artifact.title, artifact.content);
    return new Response(pdf as any, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="cfh-${artifact.id}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}
