import { prisma } from "@/lib/db";
import { requestContext } from "@/lib/security";

export async function audit(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { ipAddress } = await requestContext();
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ? (input.metadata as any) : undefined,
      ipAddress
    }
  });
}
