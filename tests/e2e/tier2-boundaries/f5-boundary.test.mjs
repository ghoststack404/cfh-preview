// tests/e2e/tier2-boundaries/f5-boundary.test.mjs
// F5 Boundary & Corner Cases (>= 5 test cases)
// Focus: Ineligibility repetition, disabled free intro, past date slots, slot collision, price tampering

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase } from '../harness/mock-env.mjs';

describe('F5 Boundary: 15-Minute Free Session Booking Edge Cases', { tier: 'tier2' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
  });

  test('F5-B.1: Student attempting second free intro with same coach is rejected as ALREADY_BOOKED', () => {
    const futureDate1 = new Date(Date.now() + 86400000).toISOString();
    const futureDate2 = new Date(Date.now() + 172800000).toISOString();

    // First free booking succeeds
    db.createBooking({
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'FREE_INTRO',
      scheduledAt: futureDate1
    });

    // Check eligibility for second attempt
    const eligibility = db.checkFreeIntroEligibility('student-1', 'coach-1');
    assert.strictEqual(eligibility.eligible, false);
    assert.strictEqual(eligibility.reason, 'ALREADY_BOOKED');

    // Second booking attempt throws error
    assert.throws(() => {
      db.createBooking({
        studentId: 'student-1',
        coachId: 'coach-1',
        type: 'FREE_INTRO',
        scheduledAt: futureDate2
      });
    }, /ALREADY_BOOKED/);
  });

  test('F5-B.2: Booking free intro on coach with freeIntroEnabled: false is rejected', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    assert.throws(() => {
      db.createBooking({
        studentId: 'student-1',
        coachId: 'coach-nofree', // coach with free intro disabled
        type: 'FREE_INTRO',
        scheduledAt: futureDate
      });
    }, /FREE_INTRO_NOT_SUPPORTED/);
  });

  test('F5-B.3: Booking free intro slot in the past is rejected as INVALID_DATE_SLOT', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

    assert.throws(() => {
      db.createBooking({
        studentId: 'student-1',
        coachId: 'coach-1',
        type: 'FREE_INTRO',
        scheduledAt: pastDate
      });
    }, /INVALID_DATE_SLOT/);
  });

  test('F5-B.4: Concurrent booking collision on identical 15-minute slot rejects second booking', () => {
    const slotTime = new Date(Date.now() + 86400000).toISOString();

    // Student 1 books slot
    db.createBooking({
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'FREE_INTRO',
      scheduledAt: slotTime
    });

    // Student 2 attempts same slot
    assert.throws(() => {
      db.createBooking({
        studentId: 'student-new',
        coachId: 'coach-1',
        type: 'FREE_INTRO',
        scheduledAt: slotTime
      });
    }, /SLOT_UNAVAILABLE/);
  });

  test('F5-B.5: Manipulated client price payload is overridden to strictly $0.00', () => {
    const slotTime = new Date(Date.now() + 86400000).toISOString();

    const booking = db.createBooking({
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'FREE_INTRO',
      scheduledAt: slotTime,
      priceManipulated: 999.99 // Malicious client attempting to alter price
    });

    assert.strictEqual(booking.price, 0, 'Server must enforce $0.00 for FREE_INTRO regardless of payload');
    assert.strictEqual(booking.durationMinutes, 15);
  });
});
