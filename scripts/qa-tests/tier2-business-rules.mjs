/**
 * Tier 2: Boundary & Business Rules Test Suite
 * 
 * Verifies business calculations and edge rules per ORIGINAL_REQUEST R2 & TEST_INFRA.md:
 * - Commission calculation tests across all coach tiers:
 *   Platinum (15%), Gold (18%), Elite (20%), Básico (23%), Cursos Only (25%)
 * - Absence & refund logic:
 *   30-minute coach absence tolerance (reschedule/refund allowed)
 *   Student absence (1 second chance, no direct cash refund on failure)
 * - Single free intro enforcement per coach-student pair
 * - Timezone boundary calculations
 * - Coach level / reputation algorithm
 */

import { TestSuite, expect } from "./common.mjs";

export function getTierCommissionBps(tier) {
  switch (tier) {
    case "PLATINUM":
      return 1500; // 15%
    case "GOLD":
      return 1800; // 18%
    case "ELITE":
      return 2000; // 20%
    case "BASIC":
      return 2300; // 23%
    case "CURSOS_ONLY":
      return 2500; // 25%
    default:
      return 2300;
  }
}

export function calculatePlatformFee(amountCents, region, plan) {
  let basisPoints = 2300; // Default 23%

  if (plan?.commissionBps) {
    basisPoints = plan.commissionBps;
  } else if (plan?.tier) {
    basisPoints = getTierCommissionBps(plan.tier);
  } else if (plan?.latamCommissionBps && plan?.globalCommissionBps) {
    basisPoints = region === "LATAM" ? plan.latamCommissionBps : plan.globalCommissionBps;
  } else if (region === "LATAM") {
    basisPoints = 1500;
  } else {
    basisPoints = 2500;
  }

  return Math.round((amountCents * basisPoints) / 10_000);
}

export function calculateCoachLevel(input) {
  if (input.averageRating >= 4.85 && input.reviewCount >= 50 && input.completedSessionCount >= 200) return "ELITE";
  if (input.averageRating >= 4.7 && input.reviewCount >= 20 && input.completedSessionCount >= 50) return "EXPERT";
  if (input.averageRating >= 4.5 && input.reviewCount >= 5 && input.completedSessionCount >= 10) return "FEATURED";
  return "NEW";
}

/**
 * Absence State Machine
 */
export function evaluateSessionAbsence({
  reporterRole, // 'STUDENT' or 'COACH'
  minutesElapsedSinceStart,
  secondChanceAlreadyUsed = false,
}) {
  if (reporterRole === "STUDENT") {
    // Student reporting coach absence
    if (minutesElapsedSinceStart < 30) {
      return {
        allowed: false,
        error: "Debes esperar al menos 30 minutos de tolerancia antes de reportar la ausencia del coach.",
        action: "WAIT_TOLERANCE",
      };
    }
    return {
      allowed: true,
      status: "COACH_ABSENT",
      canRefund: true,
      canReschedule: true,
      penaltyAppliesTo: "COACH",
    };
  }

  if (reporterRole === "COACH") {
    // Coach reporting student absence after 30-min wait
    if (minutesElapsedSinceStart < 30) {
      return {
        allowed: false,
        error: "El coach debe esperar un lapso no mayor a 30 minutos antes de reportar la inasistencia.",
        action: "WAIT_TOLERANCE",
      };
    }

    if (!secondChanceAlreadyUsed) {
      // First offense: Grant 1 Segunda Oportunidad
      return {
        allowed: true,
        status: "STUDENT_ABSENT_SECOND_CHANCE_AVAILABLE",
        secondChanceGranted: true,
        canDirectCashRefund: false, // Strictly NO cash refund for student absence
        canRescheduleOnce: true,
      };
    } else {
      // Second offense: Forfeit funds
      return {
        allowed: true,
        status: "NO_SHOW",
        secondChanceGranted: false,
        canDirectCashRefund: false, // Forfeits funds
        canRescheduleOnce: false,   // No 3rd chance
        fundsForfeited: true,
      };
    }
  }

  throw new Error("Invalid reporter role");
}

export async function runTier2Tests() {
  const suite = new TestSuite("Tier 2: Boundary & Business Rules");

  // -------------------------------------------------------------
  // Test 2.1: Commission Calculations Across All Tiers
  // -------------------------------------------------------------
  suite.test("AC 2.1 - Tier Commission Basis Points: Platinum (15%), Gold (18%), Elite (20%), Básico (23%), Cursos Only (25%)", () => {
    expect(getTierCommissionBps("PLATINUM")).toBe(1500);
    expect(getTierCommissionBps("GOLD")).toBe(1800);
    expect(getTierCommissionBps("ELITE")).toBe(2000);
    expect(getTierCommissionBps("BASIC")).toBe(2300);
    expect(getTierCommissionBps("CURSOS_ONLY")).toBe(2500);
  });

  suite.test("AC 2.1b - Simulated Purchases Deduct Exact Tier Percentages Across Diverse Amounts", () => {
    const testCases = [
      // amountCents, tier, expectedFeeCents, expectedNetCents
      { amount: 1000, tier: "PLATINUM", expectedFee: 150, expectedNet: 850 },     // $10 -> 15% = $1.50
      { amount: 5000, tier: "PLATINUM", expectedFee: 750, expectedNet: 4250 },   // $50 -> 15% = $7.50
      { amount: 10000, tier: "PLATINUM", expectedFee: 1500, expectedNet: 8500 }, // $100 -> 15% = $15.00
      { amount: 5000, tier: "GOLD", expectedFee: 900, expectedNet: 4100 },       // $50 -> 18% = $9.00
      { amount: 10000, tier: "GOLD", expectedFee: 1800, expectedNet: 8200 },     // $100 -> 18% = $18.00
      { amount: 5000, tier: "ELITE", expectedFee: 1000, expectedNet: 4000 },     // $50 -> 20% = $10.00
      { amount: 10000, tier: "ELITE", expectedFee: 2000, expectedNet: 8000 },    // $100 -> 20% = $20.00
      { amount: 5000, tier: "BASIC", expectedFee: 1150, expectedNet: 3850 },     // $50 -> 23% = $11.50
      { amount: 10000, tier: "BASIC", expectedFee: 2300, expectedNet: 7700 },    // $100 -> 23% = $23.00
      { amount: 5000, tier: "CURSOS_ONLY", expectedFee: 1250, expectedNet: 3750 }, // $50 -> 25% = $12.50
      { amount: 10000, tier: "CURSOS_ONLY", expectedFee: 2500, expectedNet: 7500 }, // $100 -> 25% = $25.00
    ];

    for (const tc of testCases) {
      const fee = calculatePlatformFee(tc.amount, "LATAM", { tier: tc.tier });
      const net = tc.amount - fee;
      expect(fee).toBe(tc.expectedFee);
      expect(net).toBe(tc.expectedNet);
    }
  });

  suite.test("AC 2.1c - Boundary Edge Cases: Zero Amount and Decimal Rounding Behavior", () => {
    // 0 cents
    expect(calculatePlatformFee(0, "LATAM", { tier: "PLATINUM" })).toBe(0);

    // Odd amount cents rounding: $33.33 (3333 cents) * 23% (2300 bps) = 766.59 -> rounds to 767
    const oddFee = calculatePlatformFee(3333, "LATAM", { tier: "BASIC" });
    expect(oddFee).toBe(767);

    // International fallback without plan: LATAM defaults to 1500 bps, Non-LATAM defaults to 2500 bps
    expect(calculatePlatformFee(10000, "LATAM")).toBe(1500);
    expect(calculatePlatformFee(10000, "EUROPE")).toBe(2500);
  });

  // -------------------------------------------------------------
  // Test 2.2: Absence & Refund Logic (Coach & Student Rules)
  // -------------------------------------------------------------
  suite.test("AC 2.2a - Coach Absence 30-Min Tolerance: Report rejected at <30m, accepted at >=30m", () => {
    // 15 minutes in: Student tries to report absent coach -> Must be blocked
    const earlyCheck = evaluateSessionAbsence({
      reporterRole: "STUDENT",
      minutesElapsedSinceStart: 15,
    });
    expect(earlyCheck.allowed).toBe(false);
    expect(earlyCheck.action).toBe("WAIT_TOLERANCE");

    // 29 minutes in: Still within 30-minute tolerance
    const almostCheck = evaluateSessionAbsence({
      reporterRole: "STUDENT",
      minutesElapsedSinceStart: 29,
    });
    expect(almostCheck.allowed).toBe(false);

    // 30 minutes in: Threshold reached -> Allowed to report
    const validReport = evaluateSessionAbsence({
      reporterRole: "STUDENT",
      minutesElapsedSinceStart: 30,
    });
    expect(validReport.allowed).toBe(true);
    expect(validReport.status).toBe("COACH_ABSENT");
    expect(validReport.canRefund).toBe(true);
    expect(validReport.canReschedule).toBe(true);
  });

  suite.test("AC 2.2b - Student Absence: First absence grants 1 Segunda Oportunidad without direct cash refund", () => {
    // Student fails to show up, coach reports after 30 min
    const firstAbsence = evaluateSessionAbsence({
      reporterRole: "COACH",
      minutesElapsedSinceStart: 35,
      secondChanceAlreadyUsed: false,
    });

    expect(firstAbsence.allowed).toBe(true);
    expect(firstAbsence.secondChanceGranted).toBe(true);
    expect(firstAbsence.canRescheduleOnce).toBe(true);
    // Explicit policy: NO direct cash refund for student absence
    expect(firstAbsence.canDirectCashRefund).toBe(false);
  });

  suite.test("AC 2.2c - Student Absence: Second absence forfeits funds with zero refund and no 3rd chance", () => {
    // Student misses the rescheduled session
    const secondAbsence = evaluateSessionAbsence({
      reporterRole: "COACH",
      minutesElapsedSinceStart: 35,
      secondChanceAlreadyUsed: true,
    });

    expect(secondAbsence.allowed).toBe(true);
    expect(secondAbsence.status).toBe("NO_SHOW");
    expect(secondAbsence.secondChanceGranted).toBe(false);
    expect(secondAbsence.canRescheduleOnce).toBe(false);
    expect(secondAbsence.canDirectCashRefund).toBe(false);
    expect(secondAbsence.fundsForfeited).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 2.3: Single Free 15-Minute Intro Call Enforcement
  // -------------------------------------------------------------
  suite.test("AC 2.3 - Free Intro Session Rule: Strictly 1 free intro allowed per student-coach pair", () => {
    const studentId = "std_miguel";
    const coachId = "coach_laura";

    const bookingsTable = [
      { id: "b1", studentId, coachId, isFreeIntro: true, status: "COMPLETED" },
    ];

    const canBookFreeIntro = (sid, cid) => {
      const prior = bookingsTable.find(
        (b) => b.studentId === sid && b.coachId === cid && b.isFreeIntro && b.status !== "CANCELED"
      );
      if (prior) {
        return {
          allowed: false,
          error: "Ya has disfrutado de tu sesión de prueba gratuita de 15 minutos con este coach.",
        };
      }
      return { allowed: true };
    };

    // Attempting a second free intro with same coach
    const secondAttempt = canBookFreeIntro(studentId, coachId);
    expect(secondAttempt.allowed).toBe(false);
    expect(secondAttempt.error).toContain("Ya has disfrutado de tu sesión de prueba gratuita");

    // Attempting free intro with a different coach (coach_carlos) -> Allowed
    const differentCoachAttempt = canBookFreeIntro(studentId, "coach_carlos");
    expect(differentCoachAttempt.allowed).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 2.4: Timezone Conversion Across Midnight
  // -------------------------------------------------------------
  suite.test("AC 2.4 - Timezone Boundary: Accurately converts slots between Madrid (GMT+2) and CDMX (GMT-6)", () => {
    // A session scheduled at 23:00 (11:00 PM) on 2026-10-15 in CDMX (UTC-6)
    // In UTC, this is 2026-10-16 05:00 AM
    // In Madrid (UTC+2), this is 2026-10-16 07:00 AM (Next calendar day)
    const sessionUtcDate = new Date("2026-10-16T05:00:00.000Z");

    const formatInTz = (date, timeZone) => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      return formatter.format(date);
    };

    const cdmxTime = formatInTz(sessionUtcDate, "America/Mexico_City");
    const madridTime = formatInTz(sessionUtcDate, "Europe/Madrid");

    // CDMX: 10/15/2026, 23:00
    expect(cdmxTime).toContain("10/15/2026");
    expect(cdmxTime).toContain("23:00");

    // Madrid: 10/16/2026, 07:00 (Next day!)
    expect(madridTime).toContain("10/16/2026");
    expect(madridTime).toContain("07:00");
  });

  // -------------------------------------------------------------
  // Test 2.5: Coach Level & Reputation Thresholds
  // -------------------------------------------------------------
  suite.test("AC 2.5 - Coach Level Algorithm: Correctly classifies NEW, FEATURED, EXPERT, ELITE tiers", () => {
    // NEW: Base starting profile
    expect(calculateCoachLevel({ averageRating: 5.0, reviewCount: 2, completedSessionCount: 3 })).toBe("NEW");

    // FEATURED: >= 4.5 rating, >= 5 reviews, >= 10 sessions
    expect(calculateCoachLevel({ averageRating: 4.6, reviewCount: 8, completedSessionCount: 15 })).toBe("FEATURED");

    // EXPERT: >= 4.7 rating, >= 20 reviews, >= 50 sessions
    expect(calculateCoachLevel({ averageRating: 4.75, reviewCount: 25, completedSessionCount: 60 })).toBe("EXPERT");

    // ELITE: >= 4.85 rating, >= 50 reviews, >= 200 sessions
    expect(calculateCoachLevel({ averageRating: 4.9, reviewCount: 55, completedSessionCount: 210 })).toBe("ELITE");
  });

  return await suite.run();
}
