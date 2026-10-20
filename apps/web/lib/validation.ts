import { z } from "zod";

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const secureUrlSchema = z.string().url().refine((value) => new URL(value).protocol === "https:", "Usa una URL segura con HTTPS.");

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(200)
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(10).max(200).regex(/[A-Z]/, "Incluye una mayúscula.").regex(/[a-z]/, "Incluye una minúscula.").regex(/\d/, "Incluye un número."),
  role: z.enum(["STUDENT", "COACH"]),
  countryCode: z.string().trim().min(2).max(5),
  headline: z.string().trim().min(10).max(140).optional(),
  biography: z.string().trim().min(80).max(5000).optional(),
  categoryId: z.string().optional(),
  hourlyRate: z.coerce.number().int().min(5).max(1000).optional(),
  introVideoUrl: secureUrlSchema.optional(),
  freeIntroEnabled: z.boolean().default(true),
  contractAccepted: z.boolean().default(false)
}).superRefine((value, ctx) => {
  if (value.role !== "COACH") return;
  for (const field of ["headline", "biography", "categoryId", "hourlyRate", "introVideoUrl"] as const) {
    if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message: "Este campo es obligatorio para coaches." });
  }
  if (!value.contractAccepted) ctx.addIssue({ code: "custom", path: ["contractAccepted"], message: "Debes aceptar el contrato para coaches." });
});

export const bookingSchema = z.object({
  coachId: z.string().min(1),
  startAt: z.string().datetime(),
  durationMinutes: z.number().int().refine((value) => [15, 30, 60, 90].includes(value)),
  notes: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const coachProfileSchema = z.object({
  headline: z.string().trim().min(10).max(140),
  biography: z.string().trim().min(80).max(5000),
  introVideoUrl: secureUrlSchema,
  hourlyRateCents: z.number().int().min(500).max(100_000),
  currency: z.enum(["USD", "MXN", "EUR"]).default("USD"),
  timezone: z.string().trim().min(3).max(80).refine(validTimeZone, "Usa una zona horaria IANA válida."),
  yearsExperience: z.number().int().min(0).max(80),
  freeIntroEnabled: z.boolean(),
  contactPhone: z.string().trim().max(40).optional().or(z.literal(""))
});

export const messageSchema = z.object({ content: z.string().trim().min(1).max(3000) });
export const reviewSchema = z.object({ bookingId: z.string().min(1), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1500).optional().or(z.literal("")) });
export const aiSchema = z.object({ type: z.enum(["TASK_PLAN", "STUDY_PLAN", "SESSION_SUMMARY", "EMOTIONAL_INSIGHTS", "MARKETING_POST", "AUTO_REPLY"]), prompt: z.string().trim().min(20).max(6000) });
export const communityPostSchema = z.object({ title: z.string().trim().min(5).max(120), content: z.string().trim().min(20).max(4000) });
