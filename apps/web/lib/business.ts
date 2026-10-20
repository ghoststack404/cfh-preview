import type { CoachLevel, CoachTier, Region } from "@prisma/client";

export function getTierCommissionBps(tier: CoachTier): number {
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

export function calculatePlatformFee(
  amountCents: number,
  region: Region,
  plan?: {
    commissionBps?: number;
    latamCommissionBps?: number;
    globalCommissionBps?: number;
    tier?: CoachTier;
  }
) {
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

export function calculateCoachLevel(input: {
  averageRating: number;
  reviewCount: number;
  completedSessionCount: number;
}): CoachLevel {
  if (input.averageRating >= 4.85 && input.reviewCount >= 50 && input.completedSessionCount >= 200) return "ELITE";
  if (input.averageRating >= 4.7 && input.reviewCount >= 20 && input.completedSessionCount >= 50) return "EXPERT";
  if (input.averageRating >= 4.5 && input.reviewCount >= 5 && input.completedSessionCount >= 10) return "FEATURED";
  return "NEW";
}

export function evaluateSessionAbsence({
  reporterRole,
  minutesElapsedSinceStart,
  secondChanceAlreadyUsed = false,
}: {
  reporterRole: "STUDENT" | "COACH";
  minutesElapsedSinceStart: number;
  secondChanceAlreadyUsed?: boolean;
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

export function money(cents: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function levelLabel(level: CoachLevel) {
  return {
    NEW: "Coach Nuevo",
    FEATURED: "Destacado",
    EXPERT: "Experto",
    ELITE: "Elite"
  }[level];
}

export function regionFromCountry(countryCode: string) {
  const code = countryCode.toUpperCase();
  const latam = new Set(["MX", "GT", "BZ", "HN", "SV", "NI", "CR", "PA", "CO", "VE", "EC", "PE", "BO", "CL", "AR", "UY", "PY", "BR", "DO", "CU", "PR"]);
  const northAmerica = new Set(["US", "CA"]);
  const europe = new Set(["ES", "PT", "FR", "DE", "IT", "GB", "IE", "NL", "BE", "CH", "AT", "PL"]);
  if (latam.has(code)) return "LATAM" as const;
  if (northAmerica.has(code)) return "NORTH_AMERICA" as const;
  if (europe.has(code)) return "EUROPE" as const;
  return "OTHER" as const;
}

const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localSchedulePosition(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const weekday = weekdayMap[parts.find((part) => part.type === "weekday")?.value ?? "Sun"];
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { weekday, minuteOfDay: hour * 60 + minute };
}

export function fitsAvailability(input: {
  startAt: Date;
  endAt: Date;
  timeZone: string;
  rules: { weekday: number; startMinute: number; endMinute: number; isActive?: boolean }[];
}) {
  const start = localSchedulePosition(input.startAt, input.timeZone);
  const end = localSchedulePosition(input.endAt, input.timeZone);
  if (start.weekday !== end.weekday) return false;
  return input.rules.some((rule) => rule.isActive !== false && rule.weekday === start.weekday && start.minuteOfDay >= rule.startMinute && end.minuteOfDay <= rule.endMinute);
}
