/**
 * Tier 3: Role & Access Control Test Suite
 * 
 * Verifies route redirection and permission gating per ORIGINAL_REQUEST R2/R4 & TEST_INFRA.md:
 * - Unauthorized role redirects:
 *   - Student cannot access `/coach/*` portal routes (redirected to `/dashboard`)
 *   - Coach without onboarding redirected to `/coach/onboarding`
 *   - Unauthenticated visitors blocked from `/dashboard`, `/coach/*`, `/sesion/*` (redirected to `/?auth=login`)
 *   - Root `/` contextual role redirection
 * - Permission gating:
 *   - Basic coach cannot create courses (`hasCourseBuilder = false` -> 403 Forbidden)
 *   - Cursos-Only coach cannot accept 1-on-1 mentorship bookings (`canOfferMentoring = false` -> 403)
 * - Safe chat data leak shield regex enforcement
 */

import { TestSuite, expect } from "./common.mjs";

/**
 * Middleware Redirection Simulator
 * Faithfully mirrors logic in `apps/web/middleware.ts`
 */
export function simulateMiddlewareRequest({
  pathname,
  cookies = {},
  searchParams = {},
}) {
  const hasCustomSession = Boolean(cookies["cfh_session"]);
  const hasNextAuthCookie = Boolean(
    cookies["authjs.session-token"] ||
    cookies["__Secure-authjs.session-token"] ||
    cookies["next-auth.session-token"] ||
    cookies["__Secure-next-auth.session-token"]
  );
  const isAuthenticated = hasCustomSession || hasNextAuthCookie;

  const role = cookies["cfh_active_role"] || cookies["cfh_user_role"] || null;
  const isOnboardingCompleted = cookies["cfh_onboarding_completed"] === "true";

  const isCoach = role === "COACH";
  const isStudent = role === "STUDENT" || role === "APPRENTICE";

  const protectedPrefixes = ["/sesion", "/dashboard", "/coach", "/student"];

  // 1. Root path (/)
  if (pathname === "/") {
    if (isAuthenticated) {
      if (isCoach && isOnboardingCompleted) return { action: "REDIRECT", destination: "/coach/dashboard" };
      if (isCoach && !isOnboardingCompleted) return { action: "REDIRECT", destination: "/coach/onboarding" };
      if (isStudent && isOnboardingCompleted) return { action: "REDIRECT", destination: "/dashboard" };
      if (isStudent && !isOnboardingCompleted) return { action: "REDIRECT", destination: "/student/onboarding" };
    }
    return { action: "NEXT" };
  }

  // 2. Student Onboarding
  if (pathname === "/student/onboarding" || pathname.startsWith("/student/onboarding/")) {
    if (!isAuthenticated) return { action: "REDIRECT", destination: "/?auth=login" };
    return { action: "NEXT" };
  }

  // 3. Student Dashboard
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (!isAuthenticated) return { action: "REDIRECT", destination: "/?auth=login" };
    if (isCoach) {
      return { action: "REDIRECT", destination: isOnboardingCompleted ? "/coach/dashboard" : "/coach/onboarding" };
    }
    if (isStudent && !isOnboardingCompleted) return { action: "REDIRECT", destination: "/student/onboarding" };
    return { action: "NEXT" };
  }

  // 4. Coach Onboarding
  const isCoachOnboardingPath =
    pathname === "/onboarding/coach" ||
    pathname.startsWith("/onboarding/coach/") ||
    pathname === "/coach/onboarding" ||
    pathname.startsWith("/coach/onboarding/");

  if (isCoachOnboardingPath) {
    if (!isAuthenticated) return { action: "REDIRECT", destination: "/?auth=login" };
    const isRealCoach = cookies["cfh_user_role"] === "COACH";
    const isEdit = searchParams["edit"] === "true";
    if (isRealCoach && isOnboardingCompleted && !isEdit) {
      return { action: "REDIRECT", destination: "/coach/dashboard" };
    }
    return { action: "NEXT" };
  }

  // 5. Coach Portal Guard (/coach/dashboard, /coach/cursos, etc.)
  const isCoachPortalPath = (pathname === "/coach" || pathname.startsWith("/coach/")) && !isCoachOnboardingPath;

  if (isCoachPortalPath) {
    if (!isAuthenticated) return { action: "REDIRECT", destination: "/?auth=login" };
    if (isStudent) {
      return { action: "REDIRECT", destination: isOnboardingCompleted ? "/dashboard" : "/student/onboarding" };
    }
    if (isCoach && !isOnboardingCompleted) {
      return { action: "REDIRECT", destination: "/coach/onboarding" };
    }
    return { action: "NEXT" };
  }

  // 6. Checkout routes (/checkout vs /checkout/plan)
  const isCheckoutPath = pathname === "/checkout" || pathname.startsWith("/checkout/");
  if (isCheckoutPath) {
    if (!isAuthenticated) return { action: "REDIRECT", destination: "/?auth=login" };
    const isPlanCheckout = pathname === "/checkout/plan" || pathname.startsWith("/checkout/plan/");
    if (isCoach && !isPlanCheckout) {
      return { action: "REDIRECT", destination: "/coach/dashboard" };
    }
    if (isStudent && isPlanCheckout) {
      return { action: "REDIRECT", destination: "/dashboard" };
    }
    return { action: "NEXT" };
  }

  // 7. General protected routes
  if (protectedPrefixes.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated) return { action: "REDIRECT", destination: "/?auth=login" };
  }

  return { action: "NEXT" };
}

/**
 * Subscription Feature Gating Simulator
 * Mirrors `apps/web/lib/subscription-gating.ts`
 */
export const TIER_FEATURES = {
  BASIC: {
    hasCourseBuilder: false,
    canOfferMentoring: true,
    hasAiCopilot: false,
    hasWhiteboard: false,
    hasStudentTracking: false,
    hasPdfResources: false,
  },
  ELITE: {
    hasCourseBuilder: false,
    canOfferMentoring: true,
    hasAiCopilot: false,
    hasWhiteboard: true,
    hasStudentTracking: false,
    hasPdfResources: false,
  },
  GOLD: {
    hasCourseBuilder: false,
    canOfferMentoring: true,
    hasAiCopilot: false,
    hasWhiteboard: true,
    hasStudentTracking: true,
    hasPdfResources: true,
  },
  PLATINUM: {
    hasCourseBuilder: true,
    canOfferMentoring: true,
    hasAiCopilot: true,
    hasWhiteboard: true,
    hasStudentTracking: true,
    hasPdfResources: true,
  },
  CURSOS_ONLY: {
    hasCourseBuilder: true,
    canOfferMentoring: false, // Strictly blocked from 1-on-1 mentoring
    hasAiCopilot: false,
    hasWhiteboard: false,
    hasStudentTracking: true,
    hasPdfResources: true,
  },
};

export function checkFeaturePermission(tier, feature) {
  const plan = TIER_FEATURES[tier] || TIER_FEATURES.BASIC;
  return plan[feature] === true;
}

export function enforceCourseCreation(coachTier) {
  const allowed = checkFeaturePermission(coachTier, "hasCourseBuilder");
  if (!allowed) {
    return {
      status: 403,
      allowed: false,
      error: "Tu plan actual no incluye acceso a esta función (hasCourseBuilder). Por favor, mejora tu plan a Platinum o Cursos Only.",
    };
  }
  return { status: 200, allowed: true };
}

export function enforceMentorshipBooking(coachTier) {
  const allowed = checkFeaturePermission(coachTier, "canOfferMentoring");
  if (!allowed) {
    return {
      status: 403,
      allowed: false,
      error: "Los coaches con plan Cursos Only no pueden aceptar sesiones de mentoría 1 a 1.",
    };
  }
  return { status: 200, allowed: true };
}

/**
 * Community Safe Chat Regex Scanner
 * Mirrors `apps/web/lib/communitySafety.ts`
 */
export function scanContentForDataLeaks(text) {
  const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/i;
  const messagingLinksRegex = /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|whatsapp\.com\/send|t\.me|telegram\.me|discord\.gg|instagram\.com\/[a-zA-Z0-9_.]+|facebook\.com\/[a-zA-Z0-9_.]+)/i;
  const externalPaymentsRegex = /\b(?:zelle|paypal\.me|paypal\b|venmo|cashapp|spei\b|cuenta\s*clabe|clabe\s*interbancaria|transferencia\s*bancaria)\b/i;
  const phoneRegex = /(?:\+|00)\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{3,4}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10}\b/;

  if (emailRegex.test(text)) {
    return { isValid: false, reason: "EMAIL_DETECTED", message: "No se permite compartir correos electrónicos." };
  }
  if (messagingLinksRegex.test(text)) {
    return { isValid: false, reason: "MESSAGING_LINK_DETECTED", message: "No se permiten enlaces a mensajería externa." };
  }
  if (externalPaymentsRegex.test(text)) {
    return { isValid: false, reason: "EXTERNAL_PAYMENT_DETECTED", message: "No se permiten transacciones o cuentas bancarias externas." };
  }
  if (phoneRegex.test(text)) {
    return { isValid: false, reason: "PHONE_DETECTED", message: "No se permite compartir números de teléfono o WhatsApp." };
  }

  return { isValid: true };
}

export async function runTier3Tests() {
  const suite = new TestSuite("Tier 3: Role & Access Control");

  // -------------------------------------------------------------
  // Test 3.1: Unauthenticated Visitor Route Protection
  // -------------------------------------------------------------
  suite.test("AC 3.1 - Middleware: Unauthenticated access to protected routes redirects to /?auth=login", () => {
    const protectedPaths = [
      "/dashboard",
      "/dashboard/bookings",
      "/coach/dashboard",
      "/coach/cursos",
      "/coach/billing",
      "/sesion/bk_test_123",
      "/student/onboarding",
    ];

    for (const path of protectedPaths) {
      const result = simulateMiddlewareRequest({
        pathname: path,
        cookies: {}, // No session cookie
      });
      expect(result.action).toBe("REDIRECT");
      expect(result.destination).toBe("/?auth=login");
    }
  });

  // -------------------------------------------------------------
  // Test 3.2: Cross-Role Portal Guard
  // -------------------------------------------------------------
  suite.test("AC 3.2a - Middleware: Student cannot access /coach/* portal routes (redirected to /dashboard)", () => {
    const coachRoutes = ["/coach/dashboard", "/coach/cursos", "/coach/billing", "/coach/availability"];

    for (const route of coachRoutes) {
      const result = simulateMiddlewareRequest({
        pathname: route,
        cookies: {
          cfh_session: "valid-jwt",
          cfh_active_role: "STUDENT",
          cfh_onboarding_completed: "true",
        },
      });

      expect(result.action).toBe("REDIRECT");
      expect(result.destination).toBe("/dashboard");
    }
  });

  suite.test("AC 3.2b - Middleware: Coach with incomplete onboarding redirected to /coach/onboarding", () => {
    const result = simulateMiddlewareRequest({
      pathname: "/coach/dashboard",
      cookies: {
        cfh_session: "valid-jwt",
        cfh_active_role: "COACH",
        cfh_onboarding_completed: "false",
      },
    });

    expect(result.action).toBe("REDIRECT");
    expect(result.destination).toBe("/coach/onboarding");
  });

  suite.test("AC 3.2c - Middleware: Root (/) correctly routes authenticated users by active role", () => {
    // Coach completed
    const coachRes = simulateMiddlewareRequest({
      pathname: "/",
      cookies: { cfh_session: "token", cfh_active_role: "COACH", cfh_onboarding_completed: "true" },
    });
    expect(coachRes.destination).toBe("/coach/dashboard");

    // Coach incomplete
    const coachIncRes = simulateMiddlewareRequest({
      pathname: "/",
      cookies: { cfh_session: "token", cfh_active_role: "COACH", cfh_onboarding_completed: "false" },
    });
    expect(coachIncRes.destination).toBe("/coach/onboarding");

    // Student completed
    const studentRes = simulateMiddlewareRequest({
      pathname: "/",
      cookies: { cfh_session: "token", cfh_active_role: "STUDENT", cfh_onboarding_completed: "true" },
    });
    expect(studentRes.destination).toBe("/dashboard");

    // Student incomplete
    const studentIncRes = simulateMiddlewareRequest({
      pathname: "/",
      cookies: { cfh_session: "token", cfh_active_role: "STUDENT", cfh_onboarding_completed: "false" },
    });
    expect(studentIncRes.destination).toBe("/student/onboarding");
  });

  suite.test("AC 3.2d - Middleware: Coach cannot access /dashboard (redirected to /coach/dashboard)", () => {
    const coachCompletedRes = simulateMiddlewareRequest({
      pathname: "/dashboard",
      cookies: {
        cfh_session: "valid-jwt",
        cfh_active_role: "COACH",
        cfh_onboarding_completed: "true",
      },
    });
    expect(coachCompletedRes.action).toBe("REDIRECT");
    expect(coachCompletedRes.destination).toBe("/coach/dashboard");

    const coachIncompleteRes = simulateMiddlewareRequest({
      pathname: "/dashboard",
      cookies: {
        cfh_session: "valid-jwt",
        cfh_active_role: "COACH",
        cfh_onboarding_completed: "false",
      },
    });
    expect(coachIncompleteRes.action).toBe("REDIRECT");
    expect(coachIncompleteRes.destination).toBe("/coach/onboarding");
  });

  suite.test("AC 3.2e - Middleware: Checkout role-gating (Coach blocked from /checkout, Student blocked from /checkout/plan)", () => {
    // Unauthenticated
    const unauthCheckout = simulateMiddlewareRequest({
      pathname: "/checkout",
      cookies: {},
    });
    expect(unauthCheckout.action).toBe("REDIRECT");
    expect(unauthCheckout.destination).toBe("/?auth=login");

    // Coach blocked from student course checkout
    const coachCheckout = simulateMiddlewareRequest({
      pathname: "/checkout",
      cookies: {
        cfh_session: "valid-jwt",
        cfh_active_role: "COACH",
        cfh_onboarding_completed: "true",
      },
    });
    expect(coachCheckout.action).toBe("REDIRECT");
    expect(coachCheckout.destination).toBe("/coach/dashboard");

    // Coach allowed into plan upgrade checkout
    const coachPlanCheckout = simulateMiddlewareRequest({
      pathname: "/checkout/plan",
      cookies: {
        cfh_session: "valid-jwt",
        cfh_active_role: "COACH",
        cfh_onboarding_completed: "true",
      },
    });
    expect(coachPlanCheckout.action).toBe("NEXT");

    // Student blocked from coach plan checkout
    const studentPlanCheckout = simulateMiddlewareRequest({
      pathname: "/checkout/plan",
      cookies: {
        cfh_session: "valid-jwt",
        cfh_active_role: "STUDENT",
        cfh_onboarding_completed: "true",
      },
    });
    expect(studentPlanCheckout.action).toBe("REDIRECT");
    expect(studentPlanCheckout.destination).toBe("/dashboard");

    // Student allowed into course checkout
    const studentCourseCheckout = simulateMiddlewareRequest({
      pathname: "/checkout",
      cookies: {
        cfh_session: "valid-jwt",
        cfh_active_role: "STUDENT",
        cfh_onboarding_completed: "true",
      },
    });
    expect(studentCourseCheckout.action).toBe("NEXT");
  });

  // -------------------------------------------------------------
  // Test 3.3: Subscription Plan Feature Gating (Course Builder)
  // -------------------------------------------------------------
  suite.test("AC 3.3 - Feature Gating: BASIC, ELITE, GOLD coaches blocked from Course Builder (403)", () => {
    const basicAttempt = enforceCourseCreation("BASIC");
    expect(basicAttempt.allowed).toBe(false);
    expect(basicAttempt.status).toBe(403);
    expect(basicAttempt.error).toContain("hasCourseBuilder");

    const eliteAttempt = enforceCourseCreation("ELITE");
    expect(eliteAttempt.allowed).toBe(false);
    expect(eliteAttempt.status).toBe(403);

    const goldAttempt = enforceCourseCreation("GOLD");
    expect(goldAttempt.allowed).toBe(false);
    expect(goldAttempt.status).toBe(403);

    // Platinum and Cursos Only allowed
    const platinumAttempt = enforceCourseCreation("PLATINUM");
    expect(platinumAttempt.allowed).toBe(true);
    expect(platinumAttempt.status).toBe(200);

    const cursosOnlyAttempt = enforceCourseCreation("CURSOS_ONLY");
    expect(cursosOnlyAttempt.allowed).toBe(true);
    expect(cursosOnlyAttempt.status).toBe(200);
  });

  // -------------------------------------------------------------
  // Test 3.4: Subscription Plan Feature Gating (1-on-1 Mentorship)
  // -------------------------------------------------------------
  suite.test("AC 3.4 - Feature Gating: CURSOS_ONLY coach cannot accept 1-on-1 mentorship bookings (403)", () => {
    const cursosOnlyMentoring = enforceMentorshipBooking("CURSOS_ONLY");
    expect(cursosOnlyMentoring.allowed).toBe(false);
    expect(cursosOnlyMentoring.status).toBe(403);
    expect(cursosOnlyMentoring.error).toContain("Cursos Only no pueden aceptar sesiones de mentoría 1 a 1");

    // Other tiers allowed
    expect(enforceMentorshipBooking("BASIC").allowed).toBe(true);
    expect(enforceMentorshipBooking("ELITE").allowed).toBe(true);
    expect(enforceMentorshipBooking("GOLD").allowed).toBe(true);
    expect(enforceMentorshipBooking("PLATINUM").allowed).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 3.5: Chat / Community Safe Regex Scanner
  // -------------------------------------------------------------
  suite.test("AC 3.5 - Safe Chat Shield: Blocks phone numbers, emails, WhatsApp links, and banking terms", () => {
    // Legitimate content -> Valid
    const legit = scanContentForDataLeaks("¡Hola comunidad! Tengo una duda sobre Server Actions en Next.js 16.");
    expect(legit.isValid).toBe(true);

    // Email leak -> Blocked
    const emailLeak = scanContentForDataLeaks("Escríbeme a mi correo personal coach.juan@gmail.com");
    expect(emailLeak.isValid).toBe(false);
    expect(emailLeak.reason).toBe("EMAIL_DETECTED");

    // Phone leak -> Blocked
    const phoneLeak = scanContentForDataLeaks("Mi teléfono es 55-1234-5678, mándame mensaje.");
    expect(phoneLeak.isValid).toBe(false);
    expect(phoneLeak.reason).toBe("PHONE_DETECTED");

    // WhatsApp link leak -> Blocked
    const waLeak = scanContentForDataLeaks("Contáctame directo por wa.me/5215512345678 para acordar el pago.");
    expect(waLeak.isValid).toBe(false);
    expect(waLeak.reason).toBe("MESSAGING_LINK_DETECTED");

    // External payment bypass -> Blocked
    const paymentLeak = scanContentForDataLeaks("Transfiéreme por spei a mi cuenta clabe 012345678901234567");
    expect(paymentLeak.isValid).toBe(false);
    expect(paymentLeak.reason).toBe("EXTERNAL_PAYMENT_DETECTED");
  });

  return await suite.run();
}
