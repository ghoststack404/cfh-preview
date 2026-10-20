"use server";

import { auth } from "@/auth";
import { currentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { sendMailSafely } from "@/lib/mail";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { decode } from "next-auth/jwt";
import type { CoachTier } from "@prisma/client";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { locales, defaultLocale } from "@/i18n";

export interface CoachCertificateInput {
  id?: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileName?: string | null;
  fileSize?: number | null;
  issuedBy?: string | null;
}


export interface CoachOnboardingData {
  headline: string;
  biography: string;
  hourlyRateCents: number;
  yearsExperience?: number;
  introVideoUrl?: string;
  videoDurationSeconds?: number;
  slug?: string;
  displayName?: string;
  currency?: string;
  timezone?: string;
  freeIntroEnabled?: boolean;
  freeIntroMinutes?: number;
  contractVersion?: string;
  categoryIds?: string[];
  tier?: CoachTier;
  avatarUrl?: string;
  showCertificates?: boolean;
  certificates?: CoachCertificateInput[];
}



export type OnboardingResult =
  | { success: true; profileId: string; slug: string; redirectUrl?: string; error?: never }
  | { success: false; error: string; profileId?: never; slug?: never; redirectUrl?: never };

/**
 * Helper unificado con 3 capas de verificación para obtener el usuario autenticado:
 * 1. NextAuth v5 auth()
 * 2. Sesión custom de lib/auth (cookies)
 * 3. Decodificación directa del JWT de NextAuth en cookies
 */
export async function getAuthenticatedUser() {
  // 1. Intentar con NextAuth v5 auth()
  try {
    const session = await auth();
    if (session?.user?.id) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, name: true, email: true, role: true, status: true, region: true, avatarUrl: true, secondChanceUsed: true, coachProfile: { select: { id: true } } },
        });
        if (user && user.status === "ACTIVE") {
          return user;
        }
      } catch (dbErr) {
        console.warn("[getAuthenticatedUser] Error en consulta DB (id), aplicando fallback de sesión:", dbErr);
        return {
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          role: (session.user as any).role ?? "COACH",
          status: "ACTIVE",
          avatarUrl: session.user.image ?? null,
          secondChanceUsed: false,
          coachProfile: null,
        };
      }
    }
    if (session?.user?.email) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, name: true, email: true, role: true, status: true, region: true, avatarUrl: true, secondChanceUsed: true, coachProfile: { select: { id: true } } },
        });
        if (user && user.status === "ACTIVE") {
          return user;
        }
      } catch (dbErr) {
        console.warn("[getAuthenticatedUser] Error en consulta DB (email):", dbErr);
      }
    }
  } catch (err) {
    console.error("[getAuthenticatedUser] Error en NextAuth auth():", err);
  }

  // 2. Intentar con sesión custom de lib/auth
  try {
    const customUser = await currentUser();
    if (customUser?.id) {
      console.log("[getAuthenticatedUser] Step 2 success for:", customUser.email);
      return {
        id: customUser.id,
        name: customUser.name ?? null,
        email: customUser.email ?? null,
        role: customUser.role ?? null,
        status: (customUser as any).status ?? null,
        avatarUrl: (customUser as any).avatarUrl ?? null,
        secondChanceUsed: (customUser as any).secondChanceUsed ?? false,
      };
    }
  } catch (err) {
    console.error("[getAuthenticatedUser] Error en custom session:", err);
  }

  // 3. Fallback: decodificar token JWT directamente de cookies de NextAuth
  try {
    const cookieStore = await cookies();
    const tokenCookie =
      cookieStore.get("authjs.session-token")?.value ||
      cookieStore.get("__Secure-authjs.session-token")?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      cookieStore.get("__Secure-next-auth.session-token")?.value;

    if (tokenCookie) {
      const isSecure = Boolean(cookieStore.get("__Secure-authjs.session-token") || cookieStore.get("__Secure-next-auth.session-token"));
      const salt = isSecure
        ? (cookieStore.get("__Secure-authjs.session-token") ? "__Secure-authjs.session-token" : "__Secure-next-auth.session-token")
        : (cookieStore.get("authjs.session-token") ? "authjs.session-token" : "next-auth.session-token");

      const decoded = await decode({
        token: tokenCookie,
        secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_development",
        salt,
      });

      if (decoded?.id || decoded?.sub) {
        const userId = ((decoded.id as string) || (decoded.sub as string));
        
        if (userId) {
          const customSession = await prisma.session.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
          });
          if (!customSession) return null;
          const sessionCreatedMs = customSession.createdAt.getTime();
          const tokenLoginMs = (decoded.loginTimestamp as number) || ((decoded.iat as number) * 1000);
          if (tokenLoginMs && tokenLoginMs < sessionCreatedMs - 5000) return null;
        }

        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, role: true, status: true, region: true, avatarUrl: true, secondChanceUsed: true, coachProfile: { select: { id: true } } },
        });
        if (dbUser && dbUser.status === "ACTIVE") {
          console.log("[getAuthenticatedUser] Step 3 success for:", dbUser.email);
          return dbUser;
        }
      }

      if (decoded?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: decoded.email as string },
          select: { id: true, name: true, email: true, role: true, status: true, region: true, avatarUrl: true, secondChanceUsed: true, coachProfile: { select: { id: true } } },
        });
        if (dbUser && dbUser.status === "ACTIVE") {
          console.log("[getAuthenticatedUser] Step 3 success for:", dbUser.email);
          return dbUser;
        }
      }
    }
  } catch (jwtErr) {
    console.error("[getAuthenticatedUser] Error decodificando JWT:", jwtErr);
  }

  console.log("[getAuthenticatedUser] Returning null");
  return null;
}

// ---------- Helpers de extracción de datos ----------
function extractFromFormData(input: FormData): CoachOnboardingData {
  const categoryIds = (input.getAll("categoryIds") as string[]).filter(Boolean);
  const freeIntroVal = input.get("freeIntroEnabled");
  const freeIntroEnabled =
    freeIntroVal === null
      ? true
      : freeIntroVal === "true" || freeIntroVal === "on" || freeIntroVal === "1";
  const showCertVal = input.get("showCertificates");
  const showCertificates = showCertVal === "true" || showCertVal === "on" || showCertVal === "1";
  let certificates: CoachCertificateInput[] = [];
  const rawCertificates = input.get("certificates");
  if (typeof rawCertificates === "string" && rawCertificates.trim() !== "") {
    try {
      certificates = JSON.parse(rawCertificates);
    } catch {}
  }

  return {
    headline: (input.get("headline") as string)?.trim() ?? "",
    biography: (input.get("biography") as string)?.trim() ?? "",
    hourlyRateCents: parseInt((input.get("hourlyRateCents") as string) || "0", 10),
    yearsExperience: parseInt((input.get("yearsExperience") as string) || "0", 10),
    introVideoUrl: (input.get("introVideoUrl") as string)?.trim() ?? "",
    videoDurationSeconds: input.get("videoDurationSeconds") ? parseInt((input.get("videoDurationSeconds") as string) || "0", 10) : undefined,
    slug: (input.get("slug") as string)?.trim() ?? "",
    displayName: (input.get("displayName") as string)?.trim() ?? undefined,
    currency: (input.get("currency") as string)?.trim() || "USD",
    timezone: (input.get("timezone") as string)?.trim() || "America/Mexico_City",
    freeIntroEnabled,
    freeIntroMinutes: parseInt((input.get("freeIntroMinutes") as string) || "15", 10),
    contractVersion: (input.get("contractVersion") as string)?.trim() || "1.0",
    categoryIds,
    tier: (input.get("tier") as CoachTier) || "BASIC",
    avatarUrl: (input.get("avatarUrl") as string)?.trim() || undefined,
    showCertificates,
    certificates,
  };
}

function extractFromObject(input: CoachOnboardingData): CoachOnboardingData {
  return {
    headline: input.headline?.trim() ?? "",
    biography: input.biography?.trim() ?? "",
    hourlyRateCents: Number(input.hourlyRateCents) || 0,
    yearsExperience: Number(input.yearsExperience) || 0,
    introVideoUrl: input.introVideoUrl?.trim() ?? "",
    videoDurationSeconds: typeof input.videoDurationSeconds === "number" ? input.videoDurationSeconds : undefined,
    slug: input.slug?.trim() ?? "",
    displayName: input.displayName?.trim() ?? undefined,
    currency: input.currency?.trim() || "USD",
    timezone: input.timezone?.trim() || "America/Mexico_City",
    freeIntroEnabled: typeof input.freeIntroEnabled === "boolean" ? input.freeIntroEnabled : true,
    freeIntroMinutes: typeof input.freeIntroMinutes === "number" ? input.freeIntroMinutes : 15,
    contractVersion: input.contractVersion?.trim() || "1.0",
    categoryIds: Array.isArray(input.categoryIds) ? input.categoryIds.filter(Boolean) : [],
    tier: input.tier || "BASIC",
    avatarUrl: input.avatarUrl?.trim() || undefined,
    showCertificates: Boolean(input.showCertificates),
    certificates: Array.isArray(input.certificates) ? input.certificates : [],
  };
}



function validate(data: CoachOnboardingData, isUpdate: boolean = false): string | null {
  if (!isUpdate && (!data.avatarUrl || data.avatarUrl.trim().length === 0)) {
    return "Es obligatorio subir una foto profesional donde se aprecie claramente tu rostro o torso superior.";
  }
  if (data.avatarUrl && (data.avatarUrl.includes("dicebear.com") || data.avatarUrl.includes("api.dicebear.com"))) {
    return "Por favor sube una fotografía real de tu rostro. No se permiten avatares ilustrados para coaches.";
  }
  if (!data.headline || data.headline.trim().length === 0) {
    return "Por favor ingresa tu titular profesional.";
  }
  if (!data.biography || data.biography.trim().length < 20) {
    return "Por favor ingresa una biografía descriptiva (mínimo 20 caracteres).";
  }
  if (!data.hourlyRateCents || data.hourlyRateCents <= 0) {
    return "Por favor define una tarifa por hora válida en USD.";
  }
  if (data.videoDurationSeconds && data.videoDurationSeconds > 300) {
    return "El video de presentación no debe exceder 5 minutos (300 segundos).";
  }
  return null;
}

// ---------- CREAR perfil (onboarding inicial) ----------
export async function completeCoachOnboarding(
  input: FormData | CoachOnboardingData
): Promise<OnboardingResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado. Debes iniciar sesión para completar el onboarding." };
    }

    const userId = user.id;
    const data = input instanceof FormData ? extractFromFormData(input) : extractFromObject(input);

    // Si ya tiene perfil, redirigir a actualización transparente
    const existingProfile = await prisma.coachProfile.findUnique({ where: { userId } });
    if (existingProfile) {
      return updateCoachProfile(input);
    }

    // Fallback al avatar del usuario si ya existe y no es dummy
    if (!data.avatarUrl && user.avatarUrl && !user.avatarUrl.startsWith("/avatars/")) {
      data.avatarUrl = user.avatarUrl;
    }

    const validationError = validate(data, false);
    if (validationError) return { success: false, error: validationError };

    // Filtrar categorías válidas
    let validCategoryIds: string[] = [];
    if (data.categoryIds && data.categoryIds.length > 0) {
      const dbCategories = await prisma.category.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true },
      });
      validCategoryIds = dbCategories.map((c) => c.id);
    }

    // Generar slug único
    const userName = user.name ?? "";
    let baseSlug = slugify(data.slug || data.headline || userName || "coach");
    if (!baseSlug) baseSlug = `coach-${userId.slice(-6)}`;
    let finalSlug = baseSlug;
    const slugConflict = await prisma.coachProfile.findUnique({ where: { slug: finalSlug } });
    if (slugConflict) finalSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const createdProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.coachProfile.create({
        data: {
          userId,
          slug: finalSlug,
          displayName: data.displayName || null,
          headline: data.headline,
          biography: data.biography,
          introVideoUrl: data.introVideoUrl ?? "",
          yearsExperience: data.yearsExperience ?? 0,
          hourlyRateCents: data.hourlyRateCents,
          currency: data.currency ?? "USD",
          timezone: data.timezone ?? "America/Mexico_City",
          freeIntroEnabled: data.freeIntroEnabled ?? true,
          freeIntroMinutes: data.freeIntroMinutes ?? 15,
          contractVersion: data.contractVersion ?? "1.0",
          contractAcceptedAt: new Date(),
          approvalStatus: "APPROVED",
          level: "NEW",
          currentTier: data.tier || "BASIC",
          showCertificates: data.showCertificates ?? false,
          photoUrl: data.avatarUrl || null,
          ...(data.certificates && data.certificates.length > 0
            ? {
                certificates: {
                  create: data.certificates.map((cert) => ({
                    title: cert.title || cert.fileName || "Certificado",
                    fileUrl: cert.fileUrl,
                    fileType: cert.fileType,
                    fileName: cert.fileName || "documento",
                    fileSize: cert.fileSize || undefined,
                    issuedBy: cert.issuedBy || undefined,
                  })),
                },
              }
            : {}),
          ...(validCategoryIds.length > 0
            ? { categories: { create: validCategoryIds.map((categoryId) => ({ categoryId })) } }
            : {}),
          availabilityRules: {
            create: [1, 2, 3, 4, 5].map((weekday) => ({
              weekday,
              startMinute: 540,
              endMinute: 1080,
              isActive: true,
            })),
          },
        },
      });

      // Asociar suscripción inicial con el plan seleccionado
      const plan = await tx.subscriptionPlan.findUnique({ where: { tier: data.tier || "BASIC" } });
      if (plan) {
        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        await tx.coachSubscription.create({
          data: {
            coachId: userId,
            planId: plan.id,
            status: "ACTIVE",
            stripeSubscriptionId: `sub_init_${userId.slice(-6)}_${Date.now().toString(36)}`,
            currentPeriodStart: now,
            currentPeriodEnd: end,
          }
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          role: "COACH",
        },
      });
      return profile;
    });

    let redirectLocale = defaultLocale;
    try {
      const cookieStore = await cookies();
      cookieStore.set("cfh_onboarding_completed", "true", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_active_role", "COACH", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_user_role", "COACH", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      const storedLocale = (cookieStore.get("NEXT_LOCALE")?.value || cookieStore.get("cfh_language")?.value || "").toLowerCase();
      if (locales.includes(storedLocale)) redirectLocale = storedLocale;
    } catch (_) {}

    const selectedPlan = data.tier
      ? await prisma.subscriptionPlan.findUnique({ where: { tier: data.tier } })
      : null;
    const redirectUrl =
      data.tier && data.tier !== "BASIC"
        ? `/${redirectLocale}/checkout/plan?planId=${selectedPlan?.id || data.tier.toLowerCase()}&from=onboarding`
        : `/${redirectLocale}/coach/dashboard`;
    return { success: true, profileId: createdProfile.id, slug: createdProfile.slug, redirectUrl };
  } catch (error: any) {
    console.error("Error en completeCoachOnboarding:", error);
    return { success: false, error: error?.message || "Ocurrió un error inesperado al procesar el onboarding." };
  }
}

// ---------- ACTUALIZAR perfil existente ----------
export async function updateCoachProfile(
  input: FormData | CoachOnboardingData
): Promise<OnboardingResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado. Debes iniciar sesión." };
    }

    const userId = user.id;
    const data = input instanceof FormData ? extractFromFormData(input) : extractFromObject(input);

    const existingProfile = await prisma.coachProfile.findUnique({ where: { userId } });
    if (!existingProfile) {
      return completeCoachOnboarding(input);
    }

    if (!data.avatarUrl && existingProfile.photoUrl) {
      data.avatarUrl = existingProfile.photoUrl;
    }

    const validationError = validate(data, true);
    if (validationError) return { success: false, error: validationError };

    // Filtrar categorías válidas
    let validCategoryIds: string[] = [];
    if (data.categoryIds && data.categoryIds.length > 0) {
      const dbCategories = await prisma.category.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true },
      });
      validCategoryIds = dbCategories.map((c) => c.id);
    }

    // Verificar slug si cambió
    let finalSlug = existingProfile.slug;
    if (data.slug && data.slug !== existingProfile.slug) {
      const newBase = slugify(data.slug);
      if (newBase) {
        const slugConflict = await prisma.coachProfile.findFirst({
          where: { slug: newBase, NOT: { userId } },
        });
        finalSlug = slugConflict ? `${newBase}-${Date.now().toString(36)}` : newBase;
      }
    }

    const updatedProfile = await prisma.$transaction(async (tx) => {
      // Eliminar categorías anteriores y recrear
      await tx.coachCategory.deleteMany({ where: { coachProfileId: existingProfile.id } });

      const updated = await tx.coachProfile.update({
        where: { userId },
        data: {
          slug: finalSlug,
          displayName: data.displayName || null,
          headline: data.headline,
          biography: data.biography,
          introVideoUrl: data.introVideoUrl ?? "",
          yearsExperience: data.yearsExperience ?? 0,
          hourlyRateCents: data.hourlyRateCents,
          currency: data.currency ?? "USD",
          timezone: data.timezone ?? "America/Mexico_City",
          freeIntroEnabled: data.freeIntroEnabled ?? true,
          freeIntroMinutes: data.freeIntroMinutes ?? 15,
          showCertificates: data.showCertificates !== undefined ? data.showCertificates : existingProfile.showCertificates,
          ...(data.avatarUrl !== undefined ? { photoUrl: data.avatarUrl || null } : {}),
          ...(data.tier ? { currentTier: data.tier } : {}),
          ...(validCategoryIds.length > 0
            ? { categories: { create: validCategoryIds.map((categoryId) => ({ categoryId })) } }
            : {}),
        },
      });

      if (data.certificates !== undefined) {
        await tx.coachCertificate.deleteMany({ where: { coachProfileId: existingProfile.id } });
        if (data.certificates.length > 0) {
          await tx.coachCertificate.createMany({
            data: data.certificates.map((cert) => ({
              coachProfileId: existingProfile.id,
              title: cert.title || cert.fileName || "Certificado",
              fileUrl: cert.fileUrl,
              fileType: cert.fileType,
              fileName: cert.fileName || "documento",
              fileSize: cert.fileSize || undefined,
              issuedBy: cert.issuedBy || undefined,
            })),
          });
        }
      }

      if (data.tier) {
        const plan = await tx.subscriptionPlan.findUnique({ where: { tier: data.tier } });
        if (plan) {
          const now = new Date();
          const end = new Date(now);
          end.setMonth(end.getMonth() + 1);
          await tx.coachSubscription.updateMany({
            where: { coachId: userId, status: { in: ["ACTIVE", "TRIALING"] } },
            data: { status: "CANCELED" }
          });
          await tx.coachSubscription.create({
            data: {
              coachId: userId,
              planId: plan.id,
              status: "ACTIVE",
              stripeSubscriptionId: `sub_upd_${userId.slice(-6)}_${Date.now().toString(36)}`,
              currentPeriodStart: now,
              currentPeriodEnd: end,
            }
          });
        }
      }
      return updated;
    });

    let redirectLocale = defaultLocale;
    try {
      const cookieStore = await cookies();
      const storedLocale = (cookieStore.get("NEXT_LOCALE")?.value || cookieStore.get("cfh_language")?.value || "").toLowerCase();
      if (locales.includes(storedLocale)) redirectLocale = storedLocale;
    } catch (_) {}

    return { success: true, profileId: updatedProfile.id, slug: updatedProfile.slug, redirectUrl: `/${redirectLocale}/coach/dashboard` };
  } catch (error: any) {
    console.error("Error en updateCoachProfile:", error);
    return { success: false, error: error?.message || "Ocurrió un error inesperado al actualizar el perfil." };
  }
}

// ---------- Consultar estado del onboarding ----------
export async function getCoachOnboardingStatus() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { authenticated: false as const, needsOnboarding: false };

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        coachProfile: {
          select: {
            id: true,
            slug: true,
            headline: true,
            biography: true,
            hourlyRateCents: true,
            yearsExperience: true,
            introVideoUrl: true,
            currency: true,
            timezone: true,
            freeIntroEnabled: true,
            freeIntroMinutes: true,
            approvalStatus: true,
            currentTier: true,
            photoUrl: true,
            showCertificates: true,
            stripeChargesEnabled: true,
            stripeAccountId: true,
            contractAcceptedAt: true,
            contractVersion: true,
            certificates: {
              select: {
                id: true,
                title: true,
                fileUrl: true,
                fileType: true,
                fileName: true,
                fileSize: true,
                issuedBy: true,
                createdAt: true,
              },
            },
            averageRating: true,
            reviewCount: true,
            completedSessionCount: true,
            categories: {
              select: {
                categoryId: true,
                category: {
                  select: { id: true, name: true, slug: true, icon: true },
                },
              },
            },
          },
        },
        coachSubscriptions: {
          where: { status: "ACTIVE" },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!fullUser) return { authenticated: false as const, needsOnboarding: false };

    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;
    const effectiveRole = (activeRoleCookie === "COACH" || activeRoleCookie === "STUDENT")
      ? activeRoleCookie
      : fullUser.role;

    const isCoachRole = effectiveRole === "COACH";
    const hasProfile = Boolean(fullUser.coachProfile);
    const hasStudentOnboarding = Boolean(
      fullUser.onboardingCompletedAt || (Array.isArray(fullUser.interests) && fullUser.interests.length > 0)
    );

    const [enrollmentsCount, studentBookingsCount] = await Promise.all([
      prisma.enrollment.count({ where: { studentId: fullUser.id, status: "ACTIVE" } }),
      prisma.booking.count({ where: { studentId: fullUser.id } }),
    ]);


    const coachPhotoUrl = (fullUser.coachProfile as any)?.photoUrl || null;
    const userAvatarUrl = fullUser.avatarUrl || null;
    const activeSubPlan = fullUser.coachSubscriptions?.[0]?.plan;
    const syncedProfile = fullUser.coachProfile
      ? {
          ...fullUser.coachProfile,
          currentTier: activeSubPlan?.tier || fullUser.coachProfile.currentTier || "BASIC",
          commissionBps: activeSubPlan?.commissionBps ?? 2300,
        }
      : null;

    return {
      authenticated: true as const,
      userId: fullUser.id,
      userName: (fullUser.coachProfile as any)?.displayName || fullUser.name,
      userEmail: fullUser.email,
      userAvatarUrl,
      coachPhotoUrl,
      createdAt: fullUser.createdAt.toISOString(),
      role: effectiveRole,
      activeRole: effectiveRole,
      dbRole: fullUser.role,
      needsOnboarding: isCoachRole && !hasProfile,
      hasProfile,
      hasStudentOnboarding,
      hasAcceptedTerms: Boolean(fullUser.coachProfile?.contractAcceptedAt || fullUser.onboardingCompletedAt),
      contractAcceptedAt: fullUser.coachProfile?.contractAcceptedAt?.toISOString() || null,
      profile: syncedProfile,
      goals: fullUser.goals || null,
      interests: (fullUser.interests as string[]) || [],
      studentStats: {
        enrollmentsCount,
        studentBookingsCount,
      },
    };
  } catch (error) {
    console.error("Error al obtener estado de onboarding:", error);
    return { authenticated: false as const, needsOnboarding: false };
  }
}

// ---------- Conmutar Rol Activo (COACH <-> STUDENT) ----------
export async function switchUserRole(targetRole: "COACH" | "STUDENT") {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado." };

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { coachProfile: true },
    });

    if (!fullUser) return { success: false, error: "Usuario no encontrado." };

    const cookieStore = await cookies();
    const storedLocale = (cookieStore.get("NEXT_LOCALE")?.value || cookieStore.get("cfh_language")?.value || "").toLowerCase();
    const locale = locales.includes(storedLocale) ? storedLocale : defaultLocale;

    if (targetRole === "COACH") {
      // Si quiere ser coach pero no tiene perfil, debe completar onboarding
      if (!fullUser.coachProfile) {
        cookieStore.set("cfh_active_role", "COACH", { path: "/", maxAge: 60 * 60 * 24 * 30 });
        cookieStore.set("cfh_onboarding_completed", "false", { path: "/", maxAge: 60 * 60 * 24 * 30 });
        return {
          success: false,
          needsOnboarding: true,
          redirectTo: `/${locale}/coach/onboarding`,
          error: "Primero debes completar tu onboarding de coach.",
        };
      }

      // Solo actualizar el rol base a COACH si no es ya ADMIN
      if (fullUser.role !== "COACH" && fullUser.role !== "ADMIN") {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "COACH" },
        });
      }

      cookieStore.set("cfh_active_role", "COACH", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_onboarding_completed", "true", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      return { success: true, role: "COACH", redirectTo: `/${locale}/coach/dashboard` };
    }

    if (targetRole === "STUDENT") {
      const hasStudentOnboarding = Boolean(
        fullUser.onboardingCompletedAt || (Array.isArray(fullUser.interests) && fullUser.interests.length > 0)
      );

      // Si no tiene onboarding de estudiante, dirigir al flujo de registro de alumno
      if (!hasStudentOnboarding) {
        cookieStore.set("cfh_active_role", "STUDENT", { path: "/", maxAge: 60 * 60 * 24 * 30 });
        cookieStore.set("cfh_onboarding_completed", "false", { path: "/", maxAge: 60 * 60 * 24 * 30 });
        return {
          success: false,
          needsOnboarding: true,
          redirectTo: `/${locale}/student/onboarding`,
          error: "Primero debes completar tu registro como alumno.",
        };
      }

      // NO rebajamos el rol base en la DB, solo seteamos la cookie activa
      cookieStore.set("cfh_active_role", "STUDENT", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_onboarding_completed", "true", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      return { success: true, role: "STUDENT", redirectTo: `/${locale}/dashboard` };
    }

    return { success: false, error: "Rol no válido." };
  } catch (err: any) {
    console.error("Error al cambiar rol:", err);
    return { success: false, error: err?.message || "Error al cambiar de rol." };
  }
}

// ---------- Actualizar foto de perfil directamente ----------
export async function updateCoachAvatar(avatarUrl: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado." };
    await prisma.coachProfile.updateMany({
      where: { userId: user.id },
      data: { photoUrl: avatarUrl },
    });
    return { success: true, avatarUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar la foto de perfil." };
  }
}

// ---------- Actualizar nombre de usuario ----------
export async function updateUserName(newName: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado." };
    const cleanName = newName.trim();
    if (!cleanName) return { success: false, error: "El nombre no puede estar vacío." };
    
    await prisma.user.update({
      where: { id: user.id },
      data: { name: cleanName },
    });
    return { success: true, name: cleanName };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar el nombre." };
  }
}

export async function saveUserAvatar(formData: FormData) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado." };

    const file = formData.get("file") as File | null;
    const presetUrl = formData.get("presetUrl") as string | null;

    const isRemove = formData.get("remove") === "true" || presetUrl === "REMOVE" || presetUrl === "DELETE";
    if (isRemove) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: null, image: null },
      });
      return { success: true, avatarUrl: null };
    }

    let finalAvatarUrl = presetUrl || "";

    if (file && typeof file === "object" && typeof file.arrayBuffer === "function") {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const rawExt = (file.name || "avatar.png").split(".").pop() || "png";
      const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const filename = `${user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

      const targetDir = process.cwd().includes("apps")
        ? path.join(process.cwd(), "public", "uploads")
        : path.join(process.cwd(), "apps", "web", "public", "uploads");

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(targetDir, filename), buffer);

      finalAvatarUrl = `/uploads/${filename}`;
    }

    if (!finalAvatarUrl) {
      return { success: false, error: "No se proporcionó ninguna imagen válida." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: finalAvatarUrl },
    });

    return { success: true, avatarUrl: finalAvatarUrl };
  } catch (err: any) {
    console.error("Error en saveUserAvatar:", err);
    return { success: false, error: err?.message || "Error al guardar la foto de perfil." };
  }
}

// ---------- Guardar foto de perfil del COACH (separada de la del aprendiz) ----------
export async function saveCoachAvatar(formData: FormData) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado." };

    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: user.id } });
    if (!coachProfile) return { success: false, error: "No tienes perfil de coach." };

    const file = formData.get("file") as File | null;
    const presetUrl = formData.get("presetUrl") as string | null;

    const isRemove = formData.get("remove") === "true" || presetUrl === "REMOVE" || presetUrl === "DELETE";
    if (isRemove) {
      await prisma.coachProfile.update({
        where: { userId: user.id },
        data: { photoUrl: null },
      });
      return { success: true, avatarUrl: null };
    }

    let finalPhotoUrl = presetUrl || "";

    if (file && typeof file === "object" && typeof file.arrayBuffer === "function") {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const rawExt = (file.name || "coach.png").split(".").pop() || "png";
      const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const filename = `coach-${user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

      const targetDir = process.cwd().includes("apps")
        ? path.join(process.cwd(), "public", "uploads")
        : path.join(process.cwd(), "apps", "web", "public", "uploads");

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(targetDir, filename), buffer);

      finalPhotoUrl = `/uploads/${filename}`;
    }

    if (!finalPhotoUrl) {
      return { success: false, error: "No se proporcionó ninguna imagen válida." };
    }

    await prisma.coachProfile.update({
      where: { userId: user.id },
      data: { photoUrl: finalPhotoUrl },
    });

    return { success: true, avatarUrl: finalPhotoUrl };
  } catch (err: any) {
    console.error("Error en saveCoachAvatar:", err);
    return { success: false, error: err?.message || "Error al guardar la foto del coach." };
  }
}


const STANDARD_PLATFORM_CATEGORIES = [
  { name: "Desarrollo personal", slug: "desarrollo-personal", description: "Metas, claridad, hábitos y liderazgo personal.", icon: "sparkles" },
  { name: "Psicología y bienestar", slug: "psicologia-bienestar", description: "Acompañamiento emocional, salud mental y mindfulness.", icon: "heart" },
  { name: "Salud, Fitness y Nutrición", slug: "salud-fitness-nutricion", description: "Entrenamiento físico, nutrición saludable y bienestar corporal.", icon: "activity" },
  { name: "Negocios y Emprendimiento", slug: "negocios-emprendimiento", description: "Creación de startups, modelos de negocio y estrategia comercial.", icon: "briefcase" },
  { name: "Ventas y Negociación", slug: "ventas-negociacion", description: "Técnicas de prospección, persuasión, cierre y ventas B2B/B2C.", icon: "trending-up" },
  { name: "Liderazgo y Gestión de Equipos", slug: "liderazgo-gestion", description: "Management, cultura de equipo, comunicación y resolución de conflictos.", icon: "users" },
  { name: "Finanzas e Inversiones", slug: "finanzas-inversiones", description: "Finanzas personales, contabilidad, bolsa, cripto y planeación financiera.", icon: "wallet" },
  { name: "Tecnología y Programación", slug: "tecnologia-programacion", description: "Desarrollo web, frontend, backend, móvil y arquitectura de software.", icon: "code" },
  { name: "Inteligencia Artificial y Datos", slug: "ia-ciencia-datos", description: "Machine learning, análisis de datos, Python, IA generativa y BI.", icon: "cpu" },
  { name: "Diseño y Creatividad", slug: "diseno-creatividad", description: "Diseño UI/UX, diseño gráfico, branding, animación y portafolio creativo.", icon: "palette" },
  { name: "Marketing Digital y Redes Sociales", slug: "marketing-digital", description: "Estrategia digital, SEO, anuncios pagados, redes sociales y contenido.", icon: "megaphone" },
  { name: "Inglés e Idiomas", slug: "ingles-idiomas", description: "Conversación en inglés, certificaciones TOEFL/IELTS y otros idiomas.", icon: "languages" },
  { name: "Fotografía, Video y Multimedia", slug: "fotografia-video", description: "Producción audiovisual, edición de video para YouTube/TikTok e iluminación.", icon: "camera" },
  { name: "Música, Canto y Producción", slug: "musica-canto", description: "Instrumentos musicales, técnica vocal, composición y producción musical.", icon: "music" },
  { name: "Educación y Apoyo Académico", slug: "apoyo-academico", description: "Matemáticas, ciencias, preparación de exámenes y tutoría académica.", icon: "book-open" },
  { name: "Productividad y Organización", slug: "productividad-organizacion", description: "Gestión del tiempo, sistemas Notion, hábitos de enfoque y metodologías ágiles.", icon: "check-circle" },
  { name: "Coaching Ejecutivo y Carrera", slug: "coaching-ejecutivo-carrera", description: "Preparación de entrevistas, optimización de CV, oratoria y transición laboral.", icon: "award" },
  { name: "Escritura y Storytelling", slug: "escritura-storytelling", description: "Redacción profesional, storytelling, creación literaria y copywriting.", icon: "feather" },
];

// ---------- Categorías disponibles ----------
export async function getOnboardingCategories() {
  try {
    const existingCount = await prisma.category.count({ where: { isActive: true } });
    if (existingCount < 12) {
      for (const cat of STANDARD_PLATFORM_CATEGORIES) {
        await prisma.category.upsert({
          where: { slug: cat.slug },
          update: { isActive: true },
          create: {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            icon: cat.icon,
            isActive: true,
          },
        }).catch(() => {});
      }
    }

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, description: true, icon: true },
      orderBy: { name: "asc" },
    });
    return { categories };
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    return { categories: [] };
  }
}

// ---------- Planes de suscripción disponibles ----------
export async function getOnboardingPlans() {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPriceCents: "asc" },
    });
    return { plans };
  } catch (error) {
    console.error("Error al obtener planes de suscripción:", error);
    return { plans: [] };
  }
}

// ---------- Solicitar nueva especialidad con notificación por correo ----------
export async function requestNewSpecialty(specialtyName: string, description?: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado. Inicia sesión para solicitar una especialidad." };
    }
    const cleanName = specialtyName.trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: "El nombre de la especialidad debe tener al menos 2 caracteres." };
    }

    const baseSlug = slugify(cleanName) || `cat-${Date.now().toString(36)}`;
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    // Crear categoría como inactiva (pendiente de aprobación)
    const category = await prisma.category.create({
      data: {
        name: cleanName,
        slug,
        description: description?.trim() || `Solicitada por el coach ${user.name || user.email}`,
        icon: "sparkles",
        isActive: false, // Inactiva hasta que el admin la apruebe
      },
    });

    // Buscar administrador para notificar por correo
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, name: true },
    });
    const adminEmail = admins.length > 0 && admins[0]?.email ? admins[0].email : "admin@coachingfromhome.local";

    const emailContent = {
      to: adminEmail,
      subject: `[Coaching From Home] Solicitud de nueva especialidad: ${cleanName}`,
      text: `El coach ${user.name || "Coach"} (${user.email}) ha solicitado agregar la especialidad: "${cleanName}".\n\nJustificación:\n${description?.trim() || "Sin justificación adicional"}\n\nFecha: ${new Date().toLocaleString()}\nEstado: Inactiva (Pendiente de aprobación).`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <h2 style="color: #0b2545; margin-top: 0;">Solicitud de Nueva Especialidad</h2>
          <p style="color: #475569; font-size: 15px;">El coach <strong>${user.name || "Coach"}</strong> (<a href="mailto:${user.email}" style="color: #134e4a;">${user.email}</a>) ha solicitado que se agregue una nueva especialidad en la plataforma:</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #134e4a; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 8px 0; color: #0b2545; font-size: 18px;">${cleanName}</h3>
            <p style="margin: 0; color: #64748b; font-size: 14px;"><strong>Justificación:</strong> ${description?.trim() || "Sin justificación adicional."}</p>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            La categoría ha sido registrada en la base de datos con estado <strong>INACTIVA</strong> (ID: <code>${category.id}</code>). Puedes revisarla y activarla en el panel administrativo.
          </p>
        </div>
      `,
    };

    await sendMailSafely(emailContent, "correo de solicitud de especialidad");

    return {
      success: true,
      category: {
        id: category.id,
        name: cleanName,
        isPending: true,
      },
      message: `Solicitud enviada exitosamente. Se ha notificado al equipo administrativo para la aprobación de "${cleanName}".`
    };
  } catch (error: any) {
    console.error("Error en requestNewSpecialty:", error);
    return { success: false, error: error?.message || "No se pudo registrar la solicitud." };
  }
}

// ---------- Cambiar o establecer contraseña de usuario ----------
export async function changeUserPassword(currentPassword: string, newPassword: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado. Inicia sesión para continuar." };

    const trimmedNew = (newPassword || "").trim();
    if (!trimmedNew || trimmedNew.length < 6) {
      return { success: false, error: "La nueva contraseña debe tener al menos 6 caracteres." };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });

    if (!dbUser) {
      return { success: false, error: "No se encontró el usuario en el sistema." };
    }

    // Si el usuario ya cuenta con contraseña previa, validar la contraseña actual
    if (dbUser.passwordHash) {
      if (!currentPassword) {
        return { success: false, error: "Por favor, ingresa tu contraseña actual para continuar." };
      }
      const isMatch = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isMatch) {
        return { success: false, error: "La contraseña actual que ingresaste es incorrecta." };
      }
      if (currentPassword === trimmedNew) {
        return { success: false, error: "La nueva contraseña no puede ser idéntica a la anterior." };
      }
    }

    // Guardar nuevo hash de contraseña (aplica tanto para cambio como para creación inicial de contraseña)
    const newHash = await hashPassword(trimmedNew);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { 
      success: true, 
      message: dbUser.passwordHash 
        ? "¡Tu contraseña ha sido actualizada con éxito!" 
        : "¡Contraseña creada y establecida con éxito! Ahora puedes iniciar sesión con correo y contraseña." 
    };
  } catch (err: any) {
    console.error("Error en changeUserPassword:", err);
    return { success: false, error: err?.message || "Ocurrió un error al actualizar la contraseña." };
  }
}

export async function checkUserHasPassword(): Promise<{ success: boolean; hasPassword: boolean }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, hasPassword: false };
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    return { success: true, hasPassword: Boolean(dbUser?.passwordHash) };
  } catch {
    return { success: false, hasPassword: false };
  }
}

// ---------- Privacidad de Presencia (Activo / Ausente) ----------
export async function updateUserPresencePrivacy(showOnline: boolean) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado." };

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, interests: true },
    });

    if (!dbUser) return { success: false, error: "Usuario no encontrado." };

    let currentInterests: string[] = [];
    if (Array.isArray(dbUser.interests)) {
      currentInterests = (dbUser.interests as any[]).map(String);
    } else if (typeof dbUser.interests === "string") {
      try {
        const parsed = JSON.parse(dbUser.interests);
        if (Array.isArray(parsed)) currentInterests = parsed.map(String);
      } catch {
        currentInterests = [];
      }
    }

    let updatedInterests: string[];
    if (showOnline) {
      // Quitar la bandera de oculto
      updatedInterests = currentInterests.filter((item) => item !== "_ONLINE_HIDDEN");
    } else {
      // Agregar la bandera de oculto si no existe
      if (!currentInterests.includes("_ONLINE_HIDDEN")) {
        updatedInterests = [...currentInterests, "_ONLINE_HIDDEN"];
      } else {
        updatedInterests = currentInterests;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { interests: updatedInterests },
    });

    return { success: true, showOnline };
  } catch (err: any) {
    console.error("Error en updateUserPresencePrivacy:", err);
    return { success: false, error: err?.message || "Error al actualizar las preferencias de privacidad." };
  }
}

// ---------- Actualizar Detalles del Perfil (Nombre, Biografía, Titular) ----------
export async function updateUserProfileDetails(data: { name: string; biography?: string; headline?: string }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autorizado." };

    const cleanName = data.name.trim();
    if (!cleanName) return { success: false, error: "El nombre no puede estar vacío." };

    const cleanBio = data.biography !== undefined ? data.biography.trim() : undefined;
    const cleanHeadline = data.headline !== undefined ? data.headline.trim() : undefined;

    // 1. Actualizar usuario base
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: cleanName,
        ...(cleanBio !== undefined ? { goals: cleanBio } : {}),
      },
    });

    // 2. Si el usuario tiene perfil de coach, actualizar también su biografía y titular en CoachProfile
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, slug: true },
    });

    if (coachProfile) {
      await prisma.coachProfile.update({
        where: { id: coachProfile.id },
        data: {
          displayName: cleanName,
          ...(cleanBio !== undefined ? { biography: cleanBio } : {}),
          ...(cleanHeadline !== undefined ? { headline: cleanHeadline } : {}),
        },
      });

      try {
        if (coachProfile.slug) {
          revalidatePath(`/coaches/${coachProfile.slug}`);
        }
        revalidatePath(`/coaches/${coachProfile.id}`);
        revalidatePath(`/coach/profile`);
        revalidatePath(`/coach/dashboard`);
      } catch (_) {}
    }

    try {
      revalidatePath(`/profile`);
      revalidatePath(`/dashboard/profile`);
      revalidatePath(`/dashboard`);
    } catch (_) {}

    return {
      success: true,
      name: cleanName,
      biography: cleanBio,
      headline: cleanHeadline,
    };
  } catch (err: any) {
    console.error("Error en updateUserProfileDetails:", err);
    return { success: false, error: err?.message || "Error al actualizar los datos del perfil." };
  }
}

export interface StudentOnboardingInput {
  interests: string[];
  goals?: string;
  region: "LATAM" | "NORTH_AMERICA" | "EUROPE" | "ASIA" | "AFRICA" | "OCEANIA" | "OTHER";
  avatarUrl?: string | null;
}

export async function completeStudentOnboarding(input: StudentOnboardingInput) {
  if (!input.interests || !Array.isArray(input.interests) || input.interests.length === 0) {
    throw new Error("Debes seleccionar al menos un área de interés");
  }
  const validRegions = ["LATAM", "NORTH_AMERICA", "EUROPE", "ASIA", "AFRICA", "OCEANIA", "OTHER"];
  if (input.region && !validRegions.includes(input.region)) {
    throw new Error("Región no válida");
  }

  const user = await getAuthenticatedUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        interests: input.interests,
        goals: input.goals?.trim() || "",
        region: (input.region as any) || "LATAM",
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        onboardingCompletedAt: new Date(),
        role: user.role === "COACH" || user.role === "ADMIN" ? user.role : "STUDENT",
      },
    });
  }

    let redirectLocale = defaultLocale;
    try {
      const cookieStore = await cookies();
      cookieStore.set("cfh_active_role", "STUDENT", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_onboarding_completed", "true", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_user_role", "STUDENT", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      if (input.region) {
        cookieStore.set("cfh_user_region", input.region, { path: "/", maxAge: 60 * 60 * 24 * 30 });
      }
      const storedLocale = (cookieStore.get("NEXT_LOCALE")?.value || cookieStore.get("cfh_language")?.value || "").toLowerCase();
      if (locales.includes(storedLocale)) redirectLocale = storedLocale;
    } catch (_) {}

    return { success: true, redirectUrl: `/${redirectLocale}/dashboard` };
}

// ---------- CANCELAR suscripción pendiente / rollback a BASIC ----------
export async function cancelPendingPlanSelection(): Promise<{ success: boolean; redirectUrl: string; error?: string }> {
  let redirectLocale = defaultLocale;
  try {
    const cookieStore = await cookies();
    const storedLocale = (cookieStore.get("NEXT_LOCALE")?.value || cookieStore.get("cfh_language")?.value || "").toLowerCase();
    if (locales.includes(storedLocale)) redirectLocale = storedLocale;
  } catch (_) {}

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, redirectUrl: `/${redirectLocale}/coach/dashboard`, error: "No autorizado. Debes iniciar sesión." };
    }

    const userId = user.id;


    await prisma.$transaction(async (tx) => {
      // 1. Degradar coachProfile.currentTier a BASIC
      await tx.coachProfile.updateMany({
        where: { userId },
        data: { currentTier: "BASIC" },
      });

      // 2. Obtener el plan BASIC
      const basicPlan = await tx.subscriptionPlan.findUnique({ where: { tier: "BASIC" } });

      // 3. Cancelar cualquier suscripción no básica
      await tx.coachSubscription.updateMany({
        where: {
          coachId: userId,
          plan: { tier: { not: "BASIC" } },
        },
        data: { status: "CANCELED" },
      });

      // 4. Asegurar que exista una suscripción activa con el plan BASIC
      if (basicPlan) {
        const existingBasicSub = await tx.coachSubscription.findFirst({
          where: { coachId: userId, planId: basicPlan.id },
        });

        const now = new Date();
        const end = new Date(now);
        end.setFullYear(end.getFullYear() + 1);

        if (existingBasicSub) {
          await tx.coachSubscription.update({
            where: { id: existingBasicSub.id },
            data: {
              status: "ACTIVE",
              currentPeriodStart: now,
              currentPeriodEnd: end,
            },
          });
        } else {
          await tx.coachSubscription.create({
            data: {
              coachId: userId,
              planId: basicPlan.id,
              status: "ACTIVE",
              stripeSubscriptionId: `sub_basic_${userId.slice(-6)}_${Date.now().toString(36)}`,
              currentPeriodStart: now,
              currentPeriodEnd: end,
            },
          });
        }
      }
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set("cfh_onboarding_completed", "true", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_active_role", "COACH", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      cookieStore.set("cfh_user_role", "COACH", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    } catch (_) {}

    return { success: true, redirectUrl: `/${redirectLocale}/coach/dashboard` };
  } catch (error: any) {
    console.error("Error en cancelPendingPlanSelection:", error);
    return { success: false, redirectUrl: `/${redirectLocale}/coach/dashboard`, error: error?.message || "Error al cancelar la selección del plan" };
  }
}

export async function updateCoachBanner(bannerUrl: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado. Inicia sesión como coach." };
    }

    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, rejectionReason: true, slug: true },
    });

    if (!profile) {
      return { success: false, error: "No se encontró el perfil de coach." };
    }

    let meta: Record<string, any> = {};
    if (profile.rejectionReason) {
      try {
        meta = JSON.parse(profile.rejectionReason);
      } catch {}
    }
    meta.bannerUrl = bannerUrl.trim();

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        rejectionReason: JSON.stringify(meta),
      },
    });

    try {
      if (profile.slug) {
        revalidatePath(`/coaches/${profile.slug}`);
      }
      revalidatePath(`/coaches/${profile.id}`);
      revalidatePath(`/coach/dashboard`);
      revalidatePath(`/coach/profile`);
    } catch {}

    return { success: true, bannerUrl: meta.bannerUrl };
  } catch (error: any) {
    console.error("Error en updateCoachBanner:", error);
    return { success: false, error: error?.message || "Error al actualizar la foto de portada." };
  }
}


