import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { contactMessage, findContactData } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { communityPostSchema } from "@/lib/validation";

export async function GET() {
  const posts = await prisma.communityPost.findMany({ where: { isVisible: true }, include: { author: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
  return ok({ posts });
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser();
    const input = communityPostSchema.parse(await request.json());
    const findings = findContactData(`${input.title}\n${input.content}`);
    if (findings.length && user.role !== "ADMIN") return Response.json({ error: contactMessage(findings), findings }, { status: 422 });
    const post = await prisma.communityPost.create({ data: { authorId: user.id, title: input.title, content: input.content } });
    return ok({ post }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
