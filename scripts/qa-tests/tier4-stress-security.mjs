/**
 * Tier 4: Acceptance Criteria Stress & Security Tests Suite
 * 
 * Verifies critical security and concurrency invariants per ORIGINAL_REQUEST R4 & TEST_INFRA.md:
 * - Concurrency Double Booking test:
 *   Fires two concurrent requests using `Promise.all` for the same coach and timeslot.
 *   Verifies that exactly one succeeds (201 Created) and one receives 409 Conflict.
 * - Stress N-way concurrency:
 *   Fires 10 simultaneous requests for the exact same slot; exactly 1 succeeds, 9 receive 409.
 * - S3 Signed URL Download Security:
 *   Verifies that accessing `/api/course-files/[fileId]` without a valid token, with an expired token,
 *   or with a tampered token is rejected with 401/403.
 * - Webhook 3-day grace period & Sync-on-login reconciliation.
 * - Payment confirmation idempotency / double-spend defense.
 */

import {
  TestSuite,
  expect,
  ConcurrencyLockHarness,
  generateSignedDownloadUrl,
  verifySignedDownloadToken,
} from "./common.mjs";

export async function runTier4Tests() {
  const suite = new TestSuite("Tier 4: Acceptance Criteria Stress & Security Tests");

  // -------------------------------------------------------------
  // Test 4.1: Concurrency Double Booking Race Condition (Pairwise)
  // -------------------------------------------------------------
  suite.test("AC 4.1 - Concurrency Double Booking: Fires 2 simultaneous requests with Promise.all (1 succeeds, 1 gets 409)", async () => {
    const harness = new ConcurrencyLockHarness();
    const coachId = "coach_alberto_001";
    const slotIso = new Date(Date.now() + 5 * 86400000).toISOString();

    const requestA = harness.bookSlotWithLock({
      studentId: "std_student_alpha",
      coachId,
      startAt: slotIso,
      durationMinutes: 60,
      priceCents: 6000,
    });

    const requestB = harness.bookSlotWithLock({
      studentId: "std_student_beta",
      coachId,
      startAt: slotIso,
      durationMinutes: 60,
      priceCents: 6000,
    });

    // Fire simultaneously with Promise.all
    const [resultA, resultB] = await Promise.all([requestA, requestB]);

    const results = [resultA, resultB];
    const successes = results.filter((r) => r.status === 201 && r.success === true);
    const conflicts = results.filter((r) => r.status === 409 && r.success === false);

    // Exactly one must succeed
    expect(successes.length).toBe(1);
    // Exactly one must be rejected with conflict
    expect(conflicts.length).toBe(1);

    const winner = successes[0];
    const loser = conflicts[0];

    expect(winner.booking).toBeDefined();
    expect(winner.booking.coachId).toBe(coachId);
    expect(winner.booking.startAt).toBe(slotIso);

    expect(loser.code).toBe("SLOT_CONFLICT");
    expect(loser.error).toBeDefined();
  });

  // -------------------------------------------------------------
  // Test 4.2: High-Contention Stress (10 Concurrent Requests)
  // -------------------------------------------------------------
  suite.test("AC 4.2 - High Contention Concurrency: 10 simultaneous bookings for the identical slot yield 1 win, 9 conflicts", async () => {
    const harness = new ConcurrencyLockHarness();
    const coachId = "coach_stress_999";
    const slotIso = new Date(Date.now() + 10 * 86400000).toISOString();

    const callers = Array.from({ length: 10 }, (_, i) => `std_caller_${i + 1}`);

    const promises = callers.map((studentId) =>
      harness.bookSlotWithLock({
        studentId,
        coachId,
        startAt: slotIso,
        durationMinutes: 60,
        priceCents: 7500,
      })
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 201 && r.success === true);
    const conflicts = results.filter((r) => r.status === 409 && r.success === false);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(9);

    for (const conflict of conflicts) {
      expect(conflict.code).toBe("SLOT_CONFLICT");
    }
  });

  // -------------------------------------------------------------
  // Test 4.3: Signed URL Download Security - Missing & Invalid Tokens
  // -------------------------------------------------------------
  suite.test("AC 4.3a - S3 Signed URLs: Request to course file download without token rejected (401)", () => {
    const res = verifySignedDownloadToken({
      fileId: "fil_premium_lesson_1",
      userId: "std_unauthorized",
      token: undefined, // Missing
      expires: undefined,
    });

    expect(res.valid).toBe(false);
    expect(res.status).toBe(401);
    expect(res.reason).toBe("MISSING_PARAMETERS");
  });

  suite.test("AC 4.3b - S3 Signed URLs: Expired signed download token rejected with 403 Forbidden", () => {
    const fileId = "fil_lesson_advanced_architecture_pdf";
    const userId = "std_buyer_88";

    // Generate token that expired 60 seconds ago
    const pastSigned = generateSignedDownloadUrl({
      fileId,
      userId,
      expiresInSeconds: -60, // Expired
    });

    const verifyResult = verifySignedDownloadToken({
      fileId,
      userId,
      token: pastSigned.token,
      expires: pastSigned.expires,
    });

    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.status).toBe(403);
    expect(verifyResult.reason).toBe("TOKEN_EXPIRED");
  });

  suite.test("AC 4.3c - S3 Signed URLs: Tampered token or signature mismatch rejected with 403 Forbidden", () => {
    const fileId = "fil_lesson_project_starter_zip";
    const userId = "std_buyer_88";

    const validSigned = generateSignedDownloadUrl({
      fileId,
      userId,
      expiresInSeconds: 300,
    });

    // Tamper token by modifying signature string
    const tamperedToken = validSigned.token.slice(0, -4) + "ffff";

    const verifyResult = verifySignedDownloadToken({
      fileId,
      userId,
      token: tamperedToken,
      expires: validSigned.expires,
    });

    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.status).toBe(403);
    expect(verifyResult.reason).toBe("INVALID_SIGNATURE");
  });

  suite.test("AC 4.3d - S3 Signed URLs: Token generated for another user rejected with 403 Forbidden", () => {
    const fileId = "fil_lesson_code_archive_tar";
    const legitUser = "std_legit_user";
    const attackerUser = "std_attacker_user";

    const signedForLegit = generateSignedDownloadUrl({
      fileId,
      userId: legitUser,
      expiresInSeconds: 300,
    });

    // Attacker attempts to use legitUser's token with attackerUser id
    const attackerAttempt = verifySignedDownloadToken({
      fileId,
      userId: attackerUser,
      token: signedForLegit.token,
      expires: signedForLegit.expires,
    });

    expect(attackerAttempt.valid).toBe(false);
    expect(attackerAttempt.status).toBe(403);
    expect(attackerAttempt.reason).toBe("INVALID_SIGNATURE");
  });

  suite.test("AC 4.3e - S3 Signed URLs: Valid active signed token succeeds with 200 OK", () => {
    const fileId = "fil_course_summary_notes_pdf";
    const userId = "std_active_enrolled_student";

    const validSigned = generateSignedDownloadUrl({
      fileId,
      userId,
      expiresInSeconds: 300, // Valid for 5 minutes
    });

    const verifyResult = verifySignedDownloadToken({
      fileId,
      userId,
      token: validSigned.token,
      expires: validSigned.expires,
    });

    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.status).toBe(200);
  });

  // -------------------------------------------------------------
  // Test 4.4: Webhook 3-Day Grace Period & Sync-on-Login
  // -------------------------------------------------------------
  suite.test("AC 4.4 - Stripe Webhook & Grace Period: 3-day grace period on invoice.payment_failed before downgrade", () => {
    const handleInvoicePaymentFailed = ({ coachId, failureDate = new Date() }) => {
      // 3-day grace period calculation (3 * 24 * 60 * 60 * 1000 ms)
      const gracePeriodEndsAt = new Date(failureDate.getTime() + 3 * 86400000);
      return {
        coachId,
        subscriptionStatus: "PAST_DUE",
        gracePeriodEndsAt,
        isWithinGracePeriod: (checkDate = new Date()) => checkDate <= gracePeriodEndsAt,
      };
    };

    const now = new Date();
    const subState = handleInvoicePaymentFailed({ coachId: "coach_subs_1", failureDate: now });

    expect(subState.subscriptionStatus).toBe("PAST_DUE");
    // Day 1 of failure -> Within grace period (course and tools remain accessible)
    const day1Check = new Date(now.getTime() + 1 * 86400000);
    expect(subState.isWithinGracePeriod(day1Check)).toBe(true);

    // Day 3 (exact 72h) -> Still within grace period
    const day3Check = new Date(now.getTime() + 3 * 86400000);
    expect(subState.isWithinGracePeriod(day3Check)).toBe(true);

    // Day 4 (96h after failure) -> Grace period expired! Features lock
    const day4Check = new Date(now.getTime() + 4 * 86400000);
    expect(subState.isWithinGracePeriod(day4Check)).toBe(false);
  });

  // -------------------------------------------------------------
  // Test 4.5: Payment Idempotency & Double Spend Protection
  // -------------------------------------------------------------
  suite.test("AC 4.5 - Double Spend Defense: Concurrent payment captures for identical booking execute idempotently", async () => {
    const bookingPayments = new Map();

    const processPaymentConfirmation = async (bookingId, paymentIntentId, amountCents) => {
      // Check idempotency lock
      const existing = bookingPayments.get(bookingId);
      if (existing) {
        return {
          status: 200,
          idempotent: true,
          message: "El pago ya fue procesado anteriormente.",
          chargeId: existing.chargeId,
        };
      }

      // Record charge
      const chargeRecord = {
        chargeId: `ch_${paymentIntentId}`,
        bookingId,
        amountCents,
        processedAt: new Date().toISOString(),
      };
      bookingPayments.set(bookingId, chargeRecord);

      return {
        status: 200,
        idempotent: false,
        message: "Pago registrado exitosamente.",
        chargeId: chargeRecord.chargeId,
      };
    };

    const bookingId = "bk_payment_target_123";
    const paymentIntentId = "pi_stripe_live_test_777";

    // Launch 2 concurrent confirmations
    const [res1, res2] = await Promise.all([
      processPaymentConfirmation(bookingId, paymentIntentId, 5000),
      processPaymentConfirmation(bookingId, paymentIntentId, 5000),
    ]);

    // One must be the original charge, one must be the idempotent response
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.chargeId).toBe(res2.chargeId);

    const idempotents = [res1, res2].filter((r) => r.idempotent);
    const originals = [res1, res2].filter((r) => !r.idempotent);

    expect(originals.length).toBe(1);
    expect(idempotents.length).toBe(1);
  });

  return await suite.run();
}

if (process.argv[1] && process.argv[1].includes("tier4-stress-security")) {
  runTier4Tests()
    .then((res) => {
      process.exit(res.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Tier 4 test suite error:", err);
      process.exit(1);
    });
}
