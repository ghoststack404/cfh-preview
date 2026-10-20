import { z } from "zod";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { handleRouteError, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { checkFeatureAccess } from "@/lib/subscription-gating";

const schema = z.object({
  rules: z.array(
    z
      .object({
        weekday: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(1).max(1440),
        isActive: z.boolean().optional().default(true),
      })
      .refine((rule) => rule.endMinute > rule.startMinute)
  ).max(28),
  timezone: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return fail("No autorizado", 401);

    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      include: {
        availabilityRules: {
          orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
        },
      },
    });

    if (!profile) return fail("Perfil de coach no encontrado", 404);

    return ok({
      rules: profile.availabilityRules,
      timezone: profile.timezone || "America/Mexico_City",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await assertSameOrigin();
    const user = await getAuthenticatedUser();
    if (!user) return fail("No autorizado", 401);

    const canMentor = await checkFeatureAccess(user.id, "canOfferMentoring");
    if (!canMentor) {
      return Response.json(
        { error: "Los coaches con plan Cursos Only no pueden aceptar sesiones de 60 min.", code: "FEATURE_LOCKED" },
        { status: 403 }
      );
    }

    const input = schema.parse(await request.json());
    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) return fail("Perfil de coach no encontrado", 404);

    await prisma.$transaction(async (tx) => {
      if (input.timezone && input.timezone !== profile.timezone) {
        await tx.coachProfile.update({
          where: { id: profile.id },
          data: { timezone: input.timezone },
        });
      }

      await tx.availabilityRule.deleteMany({
        where: { coachProfileId: profile.id },
      });

      if (input.rules.length) {
        await tx.availabilityRule.createMany({
          data: input.rules.map((rule) => ({
            coachProfileId: profile.id,
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
            isActive: rule.isActive ?? true,
          })),
        });
      }
    });

    return ok({ success: true, message: "Horarios actualizados exitosamente" });
  } catch (error) {
    return handleRouteError(error);
  }
}
