import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { z } from "zod";

const reportSchema = z.object({
  reportedUserId: z.string().optional(),
  reportedPostId: z.string().optional(),
  reason: z.string().min(10, "La razón debe tener al menos 10 caracteres").max(1000)
}).refine(data => data.reportedUserId || data.reportedPostId, {
  message: "Debe proveer al menos el ID de un usuario o contenido a reportar"
});

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    
    const body = await request.json();
    const input = reportSchema.parse(body);

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedUserId: input.reportedUserId || null,
        reportedPostId: input.reportedPostId || null,
        reason: input.reason,
      }
    });

    return ok({ success: true, reportId: report.id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
