import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, integrations: { payments: env().PAYMENTS_MODE, ai: env().AI_MODE, video: env().VIDEO_PROVIDER, mail: env().MAIL_MODE }, timestamp: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded", database: "error", latencyMs: Date.now() - started, timestamp: new Date().toISOString() }, { status: 503 });
  }
}
