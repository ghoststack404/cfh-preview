
"use server";

import { prisma } from "database";
import { currentUser } from "@/lib/auth";
import { UserRole } from "database";
import { cookies } from "next/headers";

import { getAuthenticatedUser } from "@/app/actions/onboarding";

export async function getSubscriptionPlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { monthlyPriceCents: "asc" }
  });
  return plans;
}

export async function getCurrentCoachSubscription() {
  const user = (await getAuthenticatedUser()) || (await currentUser());
  if (!user) return null;

  const cookieStore = await cookies();
  const activeRole = cookieStore.get("cfh_active_role")?.value;
  const effectiveRole = (activeRole === "COACH" || activeRole === "STUDENT") ? activeRole : user.role;
  if (effectiveRole !== UserRole.COACH) return null;

  const sub = await prisma.coachSubscription.findFirst({
    where: { coachId: user.id, status: "ACTIVE" },
    include: { plan: true },
    orderBy: { createdAt: "desc" }
  });

  if (sub) return sub;

  const profile = await prisma.coachProfile.findUnique({
    where: { userId: user.id },
    select: { currentTier: true, createdAt: true }
  });

  const activeTier = profile?.currentTier || "BASIC";
  const plan = await prisma.subscriptionPlan.findFirst({
    where: {
      OR: [
        { tier: activeTier as any },
        { code: activeTier }
      ]
    }
  });

  if (plan) {
    return {
      id: `virtual-${user.id}`,
      coachId: user.id,
      planId: plan.id,
      status: "ACTIVE" as const,
      currentPeriodStart: profile?.createdAt || new Date(),
      currentPeriodEnd: null,
      plan,
    };
  }

  return null;
}


export async function getSubscriptionPlanById(planId: string) {
  if (!planId) return null;
  const byId = await prisma.subscriptionPlan.findUnique({
    where: { id: planId }
  });
  if (byId) return byId;

  const normalized = planId.trim().toUpperCase();
  return await prisma.subscriptionPlan.findFirst({
    where: {
      OR: [
        { code: normalized },
        { tier: normalized as any },
      ],
    },
  });
}

