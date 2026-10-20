import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Review Limitation Rules — Free Intro & 1-Month Cooldown", () => {
  // Mock evaluate review eligibility logic identical to bookings action
  function checkReviewEligibility({ booking, existingReview, priorFreeIntroReview, recentReview, nowMs = Date.now() }) {
    if (existingReview) {
      return {
        canReview: false,
        error: "Esta sesión ya ha sido calificada anteriormente.",
        alreadyReviewed: true,
      };
    }

    if (booking.isFreeIntro) {
      if (priorFreeIntroReview) {
        return {
          canReview: false,
          error: "Las llamadas de prueba solo se pueden evaluar una sola vez por coach.",
          blockedByRule: true,
        };
      }
      return { canReview: true };
    }

    // 1-on-1 regular session
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (recentReview) {
      const reviewAgeMs = nowMs - new Date(recentReview.createdAt).getTime();
      if (reviewAgeMs < thirtyDaysMs) {
        const nextDate = new Date(new Date(recentReview.createdAt).getTime() + thirtyDaysMs);
        return {
          canReview: false,
          error: `Solo puedes evaluar a este coach una vez cada mes para evitar calificaciones repetitivas. Podrás volver a calificarlo a partir del ${nextDate.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.`,
          blockedByRule: true,
          nextAvailableDate: nextDate.toISOString(),
        };
      }
    }

    return { canReview: true };
  }

  it("permite evaluar una llamada de prueba gratuita por primera vez", () => {
    const res = checkReviewEligibility({
      booking: { id: "intro-1", coachId: "coach-1", isFreeIntro: true },
      existingReview: null,
      priorFreeIntroReview: null,
      recentReview: null,
    });
    assert.equal(res.canReview, true);
  });

  it("bloquea evaluar una segunda llamada de prueba gratuita con el mismo coach", () => {
    const res = checkReviewEligibility({
      booking: { id: "intro-2", coachId: "coach-1", isFreeIntro: true },
      existingReview: null,
      priorFreeIntroReview: { id: "rev-intro-1", createdAt: new Date() },
      recentReview: null,
    });
    assert.equal(res.canReview, false);
    assert.equal(res.blockedByRule, true);
    assert.match(res.error, /llamadas de prueba solo se pueden evaluar una sola vez/i);
  });

  it("bloquea calificar repetidamente la misma sesión ya evaluada (evita sin fin de veces)", () => {
    const res = checkReviewEligibility({
      booking: { id: "booking-10", coachId: "coach-1", isFreeIntro: false },
      existingReview: { id: "rev-1", rating: 5 },
      priorFreeIntroReview: null,
      recentReview: null,
    });
    assert.equal(res.canReview, false);
    assert.equal(res.alreadyReviewed, true);
    assert.match(res.error, /ya ha sido calificada anteriormente/i);
  });

  it("bloquea evaluar una sesión 1 a 1 si el alumno evaluó al coach hace menos de 30 días", () => {
    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
    const res = checkReviewEligibility({
      booking: { id: "booking-2", coachId: "coach-1", isFreeIntro: false },
      existingReview: null,
      priorFreeIntroReview: null,
      recentReview: { id: "rev-recent", createdAt: tenDaysAgo },
      nowMs: now,
    });
    assert.equal(res.canReview, false);
    assert.equal(res.blockedByRule, true);
    assert.match(res.error, /una vez cada mes/i);
    assert.ok(res.nextAvailableDate);
  });

  it("permite evaluar una sesión 1 a 1 si transcurrieron más de 30 días desde la última evaluación", () => {
    const now = Date.now();
    const thirtyOneDaysAgo = new Date(now - 31 * 24 * 60 * 60 * 1000);
    const res = checkReviewEligibility({
      booking: { id: "booking-3", coachId: "coach-1", isFreeIntro: false },
      existingReview: null,
      priorFreeIntroReview: null,
      recentReview: { id: "rev-old", createdAt: thirtyOneDaysAgo },
      nowMs: now,
    });
    assert.equal(res.canReview, true);
  });
});
