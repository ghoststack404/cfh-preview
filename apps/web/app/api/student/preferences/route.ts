import { handleRouteError, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { z } from "zod";

const preferencesSchema = z.object({
  interests: z.array(z.string()).min(1, "Selecciona al menos un interés"),
  goals: z.string().max(300).optional().default(""),
  region: z.enum(["LATAM", "NORTH_AMERICA", "EUROPE", "ASIA", "AFRICA", "OCEANIA", "OTHER"]),
  avatarUrl: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(["STUDENT", "COACH"]);
    const body = await request.json();
    const data = preferencesSchema.parse(body);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        interests: data.interests,
        goals: data.goals,
        region: data.region,
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        onboardingCompletedAt: new Date(),
        role: user.role === "COACH" || user.role === "ADMIN" ? user.role : "STUDENT",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        region: true,
        avatarUrl: true,
        interests: true,
        goals: true,
        onboardingCompletedAt: true,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set("cfh_onboarding_completed", "true", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("cfh_active_role", "STUDENT", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("cfh_user_role", "STUDENT", { path: "/", maxAge: 60 * 60 * 24 * 30 });

    return ok({ success: true, user: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    const user = await requireUser(["STUDENT", "COACH"]);

    const data = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        interests: true,
        goals: true,
        region: true,
        avatarUrl: true,
        onboardingCompletedAt: true,
      },
    });

    if (!data) return fail("Usuario no encontrado", 404);

    return ok({ preferences: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
