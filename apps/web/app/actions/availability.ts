"use server";

import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { prisma } from "@/lib/db";
import { z } from "zod";

export interface AvailabilityRuleDTO {
  id?: string;
  weekday: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  startMinute: number;
  endMinute: number;
  isActive?: boolean;
}

const ruleSchema = z
  .object({
    id: z.string().optional(),
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    isActive: z.boolean().optional().default(true),
  })
  .refine((r) => r.endMinute > r.startMinute, {
    message: "La hora de fin debe ser posterior a la hora de inicio",
  });

const updateSchema = z.object({
  rules: z.array(ruleSchema).max(28),
  timezone: z.string().optional(),
  freeIntroEnabled: z.boolean().optional(),
  freeIntroMinutes: z.number().int().min(10).max(60).optional(),
  freeIntroWeekday: z.number().int().min(0).max(6).optional().nullable(),
  freeIntroWeekdays: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  freeIntroStartMinute: z.number().int().min(0).max(1439).optional().nullable(),
  freeIntroEndMinute: z.number().int().min(1).max(1440).optional().nullable(),
});

export async function getCoachAvailability() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado", authenticated: false };
    }

    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      include: {
        availabilityRules: {
          orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
        },
      },
    });

    if (!profile) {
      const isStudent = user.role !== "COACH";
      return {
        success: false,
        error: "Perfil de coach no encontrado",
        authenticated: true,
        needsOnboarding: !isStudent,
        isStudent,
      };
    }

    let parsedRejection: any = {};
    if (profile.rejectionReason) {
      try {
        parsedRejection = JSON.parse(profile.rejectionReason);
      } catch {}
    }

    let introWeekdays: number[] = [1, 2, 3, 4, 5];
    if (Array.isArray(parsedRejection.freeIntroWeekdays)) {
      introWeekdays = parsedRejection.freeIntroWeekdays;
    } else if (parsedRejection.freeIntroWeekday !== null && parsedRejection.freeIntroWeekday !== undefined) {
      introWeekdays = [parsedRejection.freeIntroWeekday];
    }

    return {
      success: true,
      authenticated: true,
      timezone: profile.timezone || "America/Mexico_City",
      freeIntroEnabled: profile.freeIntroEnabled ?? true,
      freeIntroMinutes: profile.freeIntroMinutes ?? 15,
      freeIntroWeekday: parsedRejection.freeIntroWeekday ?? null,
      freeIntroWeekdays: introWeekdays,
      freeIntroStartMinute: parsedRejection.freeIntroStartMinute ?? null,
      freeIntroEndMinute: parsedRejection.freeIntroEndMinute ?? null,
      rules: profile.availabilityRules.map((r) => ({
        id: r.id,
        weekday: r.weekday,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        isActive: r.isActive,
      })),
    };
  } catch (error: any) {
    console.error("Error en getCoachAvailability:", error);
    return { success: false, error: error?.message || "Error al obtener disponibilidad" };
  }
}

export async function saveCoachAvailability(input: {
  rules: AvailabilityRuleDTO[];
  timezone?: string;
  freeIntroEnabled?: boolean;
  freeIntroMinutes?: number;
  freeIntroWeekday?: number | null;
  freeIntroWeekdays?: number[] | null;
  freeIntroStartMinute?: number | null;
  freeIntroEndMinute?: number | null;
}) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado. Inicia sesión para guardar." };
    }

    const parsed = updateSchema.parse(input);
    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return {
        success: false,
        error: "Debes completar tu perfil de coach antes de configurar tus horarios.",
      };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar timezone y configuración de prueba gratuita si se enviaron
      let currentMetadata: any = {};
      if (profile.rejectionReason) {
        try {
          currentMetadata = JSON.parse(profile.rejectionReason);
        } catch {}
      }

      // Si un día no tiene ninguna regla activa en rules, eliminarlo de freeIntroWeekdays
      // para asegurar sincronización consistente en ambos esquemas.
      const activeRuleWeekdays = new Set(parsed.rules.map((r) => r.weekday));
      let cleanFreeIntroWeekdays = parsed.freeIntroWeekdays;
      if (Array.isArray(cleanFreeIntroWeekdays) && cleanFreeIntroWeekdays.length > 0 && activeRuleWeekdays.size > 0) {
        cleanFreeIntroWeekdays = cleanFreeIntroWeekdays.filter((wd) => activeRuleWeekdays.has(wd));
      }

      if (parsed.freeIntroWeekday !== undefined) currentMetadata.freeIntroWeekday = parsed.freeIntroWeekday;
      if (parsed.freeIntroWeekdays !== undefined) currentMetadata.freeIntroWeekdays = cleanFreeIntroWeekdays;
      if (parsed.freeIntroStartMinute !== undefined) currentMetadata.freeIntroStartMinute = parsed.freeIntroStartMinute;
      if (parsed.freeIntroEndMinute !== undefined) currentMetadata.freeIntroEndMinute = parsed.freeIntroEndMinute;

      await tx.coachProfile.update({
        where: { id: profile.id },
        data: {
          ...(parsed.timezone ? { timezone: parsed.timezone } : {}),
          ...(parsed.freeIntroEnabled !== undefined ? { freeIntroEnabled: parsed.freeIntroEnabled } : {}),
          ...(parsed.freeIntroMinutes !== undefined ? { freeIntroMinutes: parsed.freeIntroMinutes } : {}),
          rejectionReason: JSON.stringify(currentMetadata),
        },
      });

      // 2. Reemplazar reglas de disponibilidad regulares
      await tx.availabilityRule.deleteMany({
        where: { coachProfileId: profile.id },
      });

      if (parsed.rules.length > 0) {
        await tx.availabilityRule.createMany({
          data: parsed.rules.map((rule) => ({
            coachProfileId: profile.id,
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
            isActive: rule.isActive ?? true,
          })),
        });
      }
    });

    return { success: true, message: "Disponibilidad guardada exitosamente" };
  } catch (error: any) {
    console.error("Error en saveCoachAvailability:", error);
    return {
      success: false,
      error: error?.errors?.[0]?.message || error?.message || "Error al guardar horarios",
    };
  }
}
