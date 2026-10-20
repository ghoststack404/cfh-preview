import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const admin = await requireUser(["ADMIN"]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    if (id === admin.id && input.status === "SUSPENDED") return Response.json({ error: "No puedes suspender tu propia cuenta." }, { status: 409 });
    const user = await prisma.user.update({ where: { id }, data: { status: input.status } });
    if (input.status === "SUSPENDED") await prisma.session.deleteMany({ where: { userId: id } });
    await audit({ actorId: admin.id, action: `USER_${input.status}`, entityType: "User", entityId: id });
    return ok({ user: { id: user.id, status: user.status } });
  } catch (error) {
    return handleRouteError(error);
  }
}
