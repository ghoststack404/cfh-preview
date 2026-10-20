import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSameOrigin, sha256 } from "@/lib/security";
import { validatePassword } from "@/lib/password-validator";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().refine((pwd) => validatePassword(pwd).isValid, {
    message: "La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número, un símbolo especial y sin espacios en blanco.",
  }),
});

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const input = schema.parse(await request.json());
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(input.token) } });
    if (!reset || reset.usedAt || !reset.expiresAt || reset.expiresAt <= new Date()) return Response.json({ error: "El enlace ya no es válido." }, { status: 400 });
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: reset.userId } })
    ]);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
