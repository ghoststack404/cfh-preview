import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertSameOrigin, encryptPrivateValue } from "@/lib/security";
import { coachProfileSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireUser(["COACH"]);
    const profile = await prisma.coachProfile.findUnique({ where: { userId: user.id }, include: { categories: { include: { category: true } }, availabilityRules: true } });
    return ok({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await assertSameOrigin();
    const user = await requireUser(["COACH"]);
    const input = coachProfileSchema.parse(await request.json());
    const current = await prisma.coachProfile.findUnique({ where: { userId: user.id } });
    if (!current) throw new Error("NOT_FOUND");
    const reviewAgain = current.headline !== input.headline || current.biography !== input.biography || current.introVideoUrl !== input.introVideoUrl;
    const [profile] = await prisma.$transaction([
      prisma.coachProfile.update({
        where: { userId: user.id },
        data: {
          headline: input.headline,
          biography: input.biography,
          introVideoUrl: input.introVideoUrl,
          hourlyRateCents: input.hourlyRateCents,
          currency: input.currency,
          timezone: input.timezone,
          yearsExperience: input.yearsExperience,
          freeIntroEnabled: input.freeIntroEnabled,
          approvalStatus: reviewAgain && ["APPROVED", "REJECTED"].includes(current.approvalStatus) ? "PENDING" : undefined,
          rejectionReason: reviewAgain ? null : undefined
        }
      }),
      prisma.user.update({ where: { id: user.id }, data: { contactPhoneEncrypted: input.contactPhone ? encryptPrivateValue(input.contactPhone) : null } })
    ]);
    await audit({ actorId: user.id, action: "COACH_PROFILE_UPDATED", entityType: "CoachProfile", entityId: profile.id, metadata: { reviewAgain } });
    return ok({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
