
import { prisma } from "@/lib/db";
import { currentUser } from "./auth";
import { UserRole } from "@prisma/client";

export type PlanFeature = 
  | "hasAiCopilot"
  | "hasCourseBuilder"
  | "hasWhatsappReminders"
  | "hasStudentTracking"
  | "hasWhiteboard"
  | "hasPdfResources"
  | "canOfferMentoring";

export const TIER_FEATURES: Record<string, Record<PlanFeature, boolean>> = {
  BASIC: {
    hasCourseBuilder: false,
    canOfferMentoring: true,
    hasAiCopilot: false,
    hasWhiteboard: false,
    hasStudentTracking: false,
    hasPdfResources: false,
    hasWhatsappReminders: false,
  },
  ELITE: {
    hasCourseBuilder: false,
    canOfferMentoring: true,
    hasAiCopilot: false,
    hasWhiteboard: true,
    hasStudentTracking: false,
    hasPdfResources: false,
    hasWhatsappReminders: false,
  },
  GOLD: {
    hasCourseBuilder: false,
    canOfferMentoring: true,
    hasAiCopilot: false,
    hasWhiteboard: true,
    hasStudentTracking: true,
    hasPdfResources: true,
    hasWhatsappReminders: false,
  },
  PLATINUM: {
    hasCourseBuilder: true,
    canOfferMentoring: true,
    hasAiCopilot: true,
    hasWhiteboard: true,
    hasStudentTracking: true,
    hasPdfResources: true,
    hasWhatsappReminders: true,
  },
  CURSOS_ONLY: {
    hasCourseBuilder: true,
    canOfferMentoring: false, // Strictly blocked from 1-on-1 mentoring
    hasAiCopilot: false,
    hasWhiteboard: false,
    hasStudentTracking: true,
    hasPdfResources: true,
    hasWhatsappReminders: false,
  },
};

export function checkFeaturePermission(tier: string, feature: PlanFeature): boolean {
  const plan = TIER_FEATURES[tier] || TIER_FEATURES.BASIC;
  return Boolean(plan?.[feature]);
}

export function enforceCourseCreation(coachTier: string) {
  const allowed = checkFeaturePermission(coachTier, "hasCourseBuilder");
  if (!allowed) {
    return {
      status: 403,
      allowed: false,
      code: "FEATURE_LOCKED",
      error: "Tu plan actual no incluye acceso a esta función (hasCourseBuilder). Por favor, mejora tu plan a Platinum o Cursos Only.",
    };
  }
  return { status: 200, allowed: true };
}

export function enforceMentorshipBooking(coachTier: string) {
  const allowed = checkFeaturePermission(coachTier, "canOfferMentoring");
  if (!allowed) {
    return {
      status: 403,
      allowed: false,
      code: "FEATURE_LOCKED",
      error: "Los coaches con plan Cursos Only no pueden aceptar sesiones de 60 min.",
    };
  }
  return { status: 200, allowed: true };
}

export class FeatureLockedError extends Error {
  code = "FEATURE_LOCKED";
  status = 403;
  constructor(message = "Tu plan actual no permite esta función.") {
    super(message);
    this.name = "FeatureLockedError";
  }
}

/**
 * Checks if a coach has access to a specific feature based on their current active subscription.
 * Allows access during the 3-day grace period (status: PAST_DUE with unexpired gracePeriodEndsAt).
 */
export async function checkFeatureAccess(coachId: string, feature: PlanFeature): Promise<boolean> {
  const now = new Date();
  const subscription = await prisma.coachSubscription.findFirst({
    where: {
      coachId,
      OR: [
        { status: "ACTIVE" },
        {
          status: "PAST_DUE",
          gracePeriodEndsAt: { gte: now },
        },
      ],
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const tier = subscription?.plan?.tier || "BASIC";

  if (feature === "canOfferMentoring") {
    return tier !== "CURSOS_ONLY";
  }

  if (feature === "hasCourseBuilder") {
    return tier === "PLATINUM" || tier === "CURSOS_ONLY" || subscription?.plan?.hasCourseBuilder === true;
  }

  if (subscription?.plan && feature in subscription.plan) {
    return (subscription.plan as any)[feature] === true;
  }

  return checkFeaturePermission(tier, feature);
}

/**
 * Convenience method for Server Actions and Server Components
 */
export async function requireFeatureAccess(
  coachIdOrFeature: string,
  maybeFeature?: PlanFeature
): Promise<boolean> {
  let coachId: string;
  let feature: PlanFeature;

  if (maybeFeature) {
    coachId = coachIdOrFeature;
    feature = maybeFeature;
  } else {
    const user = await currentUser();
    if (!user || (user.role as any) !== UserRole.COACH) {
      throw new Error("No tienes permisos de Coach.");
    }
    coachId = user.id;
    feature = coachIdOrFeature as PlanFeature;
  }

  const hasAccess = await checkFeatureAccess(coachId, feature);
  if (!hasAccess) {
    throw new FeatureLockedError("Tu plan actual no permite esta función.");
  }

  return true;
}


