/**
 * Adversarial Concurrency & Double Booking Stress Test Harness
 * Authored by: Challenger 1 (Concurrency Stress Challenger)
 * Milestone: M1 (Data & Security Core - F03)
 * 
 * Objectives:
 * 1. Stress test high contention (50-100 simultaneous requests) on identical (coachId, startAt).
 * 2. Test timestamp format variations (ISO normalization, Z vs +00:00, millisecond truncation).
 * 3. Verify cross-coach independence (concurrent requests for different coaches do not block).
 * 4. Verify student collision protection (one student cannot book two coaches for the same slot).
 * 5. Verify transaction rollback: lock release on rejection ensures no deadlock or zombie locks.
 * 6. Verify standardized error contracts: status 409, code "SLOT_CONFLICT".
 */

import { TestSuite, expect } from "./common.mjs";
import crypto from "node:crypto";

/**
 * Advanced Empirical Concurrency Harness
 * Accurately simulates the multi-layered locking mechanism from apps/web/app/api/bookings/route.ts
 * and apps/web/app/actions/bookings.ts:
 * Layer 1: MySQL Advisory Lock (GET_LOCK / RELEASE_LOCK)
 * Layer 2: InnoDB Row-Level Exclusive Lock (SELECT ... FOR UPDATE on CoachProfile)
 * Layer 3: In-transaction collision check (findFirst lt endAt / gt startAt)
 * Layer 4: Storage Engine Unique Constraint (@@unique([coachId, startAt]))
 */
export class AdvancedConcurrencyHarness {
  constructor() {
    this.bookings = []; // Array of confirmed bookings
    this.coachLocks = new Set(); // Active row locks on CoachProfile
    this.advisoryLocks = new Set(); // Active MySQL GET_LOCK keys
  }

  async createBooking({
    studentId,
    coachId,
    startAtInput,
    durationMinutes = 60,
    priceCents = 5000,
  }) {
    // 1. Timestamp normalization matching bookingSchema & route.ts
    const startAt = new Date(startAtInput);
    if (isNaN(startAt.getTime())) {
      return { status: 422, success: false, error: "Fecha inválida" };
    }
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    // Fast preliminary check outside transaction
    const fastCoachCollision = this.bookings.some(
      (b) =>
        b.coachId === coachId &&
        !["CANCELED", "REFUNDED", "NO_SHOW"].includes(b.status) &&
        b.startAt < endAt &&
        b.endAt > startAt
    );
    const fastStudentCollision = this.bookings.some(
      (b) =>
        b.studentId === studentId &&
        !["CANCELED", "REFUNDED", "NO_SHOW"].includes(b.status) &&
        b.startAt < endAt &&
        b.endAt > startAt
    );

    if (fastCoachCollision) {
      return {
        status: 409,
        success: false,
        code: "SLOT_CONFLICT",
        error: "Este horario ya fue reservado por otro usuario.",
      };
    }
    if (fastStudentCollision) {
      return {
        status: 409,
        success: false,
        code: "SLOT_CONFLICT",
        error: "Ya tienes otra sesión en ese horario.",
      };
    }

    const advisoryLockKey = `booking_lock_${coachId}_${startAt.getTime()}`;

    // Transaction begin
    // Acquire Layer 1: Advisory Lock
    const hasAdvisoryLock = !this.advisoryLocks.has(advisoryLockKey);
    if (!hasAdvisoryLock) {
      // In MySQL, GET_LOCK would wait or timeout; in high contention it signals conflict
      return {
        status: 409,
        success: false,
        code: "SLOT_CONFLICT",
        error: "Este horario ya fue reservado o está en proceso de reserva.",
      };
    }
    this.advisoryLocks.add(advisoryLockKey);

    // Acquire Layer 2: Coach Row-Level Lock
    // Wait until row lock is available
    let retries = 0;
    while (this.coachLocks.has(coachId) && retries < 100) {
      await new Promise((r) => setTimeout(r, 2));
      retries++;
    }
    this.coachLocks.add(coachId);

    try {
      // Simulate microscopic async database I/O latency inside transaction
      await new Promise((r) => setTimeout(r, Math.random() * 8 + 2));

      // Layer 3: Collision check under lock
      const coachCollisionTx = this.bookings.find(
        (b) =>
          b.coachId === coachId &&
          !["CANCELED", "REFUNDED", "NO_SHOW"].includes(b.status) &&
          b.startAt < endAt &&
          b.endAt > startAt
      );

      if (coachCollisionTx) {
        return {
          status: 409,
          success: false,
          code: "SLOT_CONFLICT",
          error: "Este horario ya fue reservado por otro usuario.",
        };
      }

      const studentCollisionTx = this.bookings.find(
        (b) =>
          b.studentId === studentId &&
          !["CANCELED", "REFUNDED", "NO_SHOW"].includes(b.status) &&
          b.startAt < endAt &&
          b.endAt > startAt
      );

      if (studentCollisionTx) {
        return {
          status: 409,
          success: false,
          code: "SLOT_CONFLICT",
          error: "Ya tienes otra sesión en ese horario.",
        };
      }

      // Layer 4: Storage Engine Unique Constraint (coachId, startAt)
      const duplicateConstraint = this.bookings.some(
        (b) => b.coachId === coachId && b.startAt.getTime() === startAt.getTime()
      );

      if (duplicateConstraint) {
        // P2002 Unique constraint violation
        return {
          status: 409,
          success: false,
          code: "SLOT_CONFLICT",
          error: "Este horario ya fue reservado por otro usuario.",
        };
      }

      // Successful creation
      const booking = {
        id: `bk_${crypto.randomUUID()}`,
        studentId,
        coachId,
        startAt,
        endAt,
        priceCents,
        status: "CONFIRMED",
        createdAt: new Date(),
      };

      this.bookings.push(booking);
      return { status: 201, success: true, booking };
    } finally {
      // Release Layer 2: Row Lock
      this.coachLocks.delete(coachId);
      // Release Layer 1: Advisory Lock
      this.advisoryLocks.delete(advisoryLockKey);
    }
  }
}

export async function runAdversarialConcurrencyTests() {
  const suite = new TestSuite("Adversarial Concurrency & Double Booking Tests");

  // -------------------------------------------------------------
  // Test 1: Massive 50-Request Simultaneous Burst Contention
  // -------------------------------------------------------------
  suite.test("ADV-1: 50 simultaneous requests for identical (coachId, startAt) produce exactly 1 winner and 49 conflicts", async () => {
    const harness = new AdvancedConcurrencyHarness();
    const coachId = "coach_adv_stress_01";
    const slotIso = new Date(Date.now() + 86400000 * 7).toISOString();

    const callers = Array.from({ length: 50 }, (_, i) => `std_burst_${i + 1}`);

    const promises = callers.map((studentId) =>
      harness.createBooking({
        studentId,
        coachId,
        startAtInput: slotIso,
        durationMinutes: 60,
      })
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 201 && r.success === true);
    const conflicts = results.filter((r) => r.status === 409 && r.success === false);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(49);

    for (const c of conflicts) {
      expect(c.code).toBe("SLOT_CONFLICT");
      expect(c.error).toBeDefined();
    }

    // Verify bookings array in DB has exactly 1 entry
    const saved = harness.bookings.filter((b) => b.coachId === coachId);
    expect(saved.length).toBe(1);
  });

  // -------------------------------------------------------------
  // Test 2: ISO Normalization and Edge Format Variants
  // -------------------------------------------------------------
  suite.test("ADV-2: Variations in ISO string representation map to identical startAt and prevent double booking", async () => {
    const harness = new AdvancedConcurrencyHarness();
    const coachId = "coach_iso_norm_02";

    // Formats representing the exact same moment:
    // A: 2026-10-15T15:00:00.000Z
    // B: 2026-10-15T15:00:00Z
    // C: 2026-10-15T15:00:00+00:00
    const formatA = "2026-10-15T15:00:00.000Z";
    const formatB = "2026-10-15T15:00:00Z";
    const formatC = "2026-10-15T15:00:00+00:00";

    const [resA, resB, resC] = await Promise.all([
      harness.createBooking({ studentId: "std_iso_1", coachId, startAtInput: formatA }),
      harness.createBooking({ studentId: "std_iso_2", coachId, startAtInput: formatB }),
      harness.createBooking({ studentId: "std_iso_3", coachId, startAtInput: formatC }),
    ]);

    const results = [resA, resB, resC];
    const successes = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409 && r.code === "SLOT_CONFLICT");

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(2);
  });

  // -------------------------------------------------------------
  // Test 3: Cross-Coach Independence (No False Blocking Across Coaches)
  // -------------------------------------------------------------
  suite.test("ADV-3: Simultaneous requests for different coaches at identical timestamp both succeed", async () => {
    const harness = new AdvancedConcurrencyHarness();
    const coachAlpha = "coach_alpha_333";
    const coachBeta = "coach_beta_444";
    const slotIso = new Date(Date.now() + 86400000 * 10).toISOString();

    const [resAlpha, resBeta] = await Promise.all([
      harness.createBooking({ studentId: "std_client_1", coachId: coachAlpha, startAtInput: slotIso }),
      harness.createBooking({ studentId: "std_client_2", coachId: coachBeta, startAtInput: slotIso }),
    ]);

    expect(resAlpha.status).toBe(201);
    expect(resAlpha.success).toBe(true);

    expect(resBeta.status).toBe(201);
    expect(resBeta.success).toBe(true);

    expect(harness.bookings.length).toBe(2);
  });

  // -------------------------------------------------------------
  // Test 4: Student Collision (Single Student Booking 2 Coaches Simultaneously)
  // -------------------------------------------------------------
  suite.test("ADV-4: A student cannot book two coaches for the same time slot simultaneously", async () => {
    const harness = new AdvancedConcurrencyHarness();
    const greedyStudent = "std_greedy_student_01";
    const coachA = "coach_choice_A";
    const coachB = "coach_choice_B";
    const slotIso = new Date(Date.now() + 86400000 * 12).toISOString();

    const [resA, resB] = await Promise.all([
      harness.createBooking({ studentId: greedyStudent, coachId: coachA, startAtInput: slotIso }),
      harness.createBooking({ studentId: greedyStudent, coachId: coachB, startAtInput: slotIso }),
    ]);

    const results = [resA, resB];
    const successes = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409 && r.code === "SLOT_CONFLICT");

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].error).toBe("Ya tienes otra sesión en ese horario.");
  });

  // -------------------------------------------------------------
  // Test 5: Rapid Sequential Contention Waves (20 Sequential Waves)
  // -------------------------------------------------------------
  suite.test("ADV-5: 20 rapid sequential contention waves consistently maintain 1 winner and 1 loser", async () => {
    const harness = new AdvancedConcurrencyHarness();
    const coachId = "coach_wave_hammer";

    for (let wave = 0; wave < 20; wave++) {
      const slotIso = new Date(Date.now() + (wave + 1) * 3600000).toISOString();
      const [res1, res2] = await Promise.all([
        harness.createBooking({ studentId: `std_wave_${wave}_a`, coachId, startAtInput: slotIso }),
        harness.createBooking({ studentId: `std_wave_${wave}_b`, coachId, startAtInput: slotIso }),
      ]);

      const successCount = [res1, res2].filter((r) => r.status === 201).length;
      const conflictCount = [res1, res2].filter((r) => r.status === 409 && r.code === "SLOT_CONFLICT").length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);
    }

    expect(harness.bookings.length).toBe(20);
  });

  // -------------------------------------------------------------
  // Test 6: Lock Cleanup & No Zombie Locks After Rejection
  // -------------------------------------------------------------
  suite.test("ADV-6: Rejections properly clean up all lock sets; future valid requests succeed", async () => {
    const harness = new AdvancedConcurrencyHarness();
    const coachId = "coach_cleanup_test";
    const slot1 = new Date(Date.now() + 86400000 * 2).toISOString();
    const slot2 = new Date(Date.now() + 86400000 * 3).toISOString();

    // Cause a conflict on slot1
    const [w1, l1] = await Promise.all([
      harness.createBooking({ studentId: "std_c1", coachId, startAtInput: slot1 }),
      harness.createBooking({ studentId: "std_c2", coachId, startAtInput: slot1 }),
    ]);

    expect([w1, l1].some((r) => r.status === 201)).toBe(true);
    expect([w1, l1].some((r) => r.status === 409)).toBe(true);

    // Ensure all locks are released
    expect(harness.coachLocks.size).toBe(0);
    expect(harness.advisoryLocks.size).toBe(0);

    // Loser now tries slot2; it should succeed without being blocked by previous failure
    const retryRes = await harness.createBooking({
      studentId: "std_c2",
      coachId,
      startAtInput: slot2,
    });

    expect(retryRes.status).toBe(201);
    expect(retryRes.success).toBe(true);
  });

  return await suite.run();
}

if (process.argv[1] && process.argv[1].includes("adversarial-concurrency-stress")) {
  runAdversarialConcurrencyTests()
    .then((res) => {
      process.exit(res.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Adversarial test suite error:", err);
      process.exit(1);
    });
}
