// tests/e2e/tier1-features/f5-free-booking.test.mjs
// F5: 15-Minute Free Session Booking (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R2, PROJECT.md F5, M2

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase } from '../harness/mock-env.mjs';
import { assertValidFreeBooking } from '../harness/contracts.mjs';

describe('F5: 15-Minute Free Session Booking', { tier: 'tier1' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
  });

  test('F5.1: Coach offering free intro shows eligible status for student', () => {
    const eligibility = db.checkFreeIntroEligibility('student-1', 'coach-1');
    assert.strictEqual(eligibility.eligible, true, 'First-time student should be eligible for free intro');
    assert.strictEqual(eligibility.durationMinutes, 15, 'Free intro slot duration must be 15 minutes');
    assert.strictEqual(eligibility.price, 0, 'Free intro price must be $0.00');
  });

  test('F5.2: Booking creation sets duration to 15 minutes and price to $0.00', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const booking = db.createBooking({
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'FREE_INTRO',
      scheduledAt: futureDate
    });

    assertValidFreeBooking(booking);
    assert.strictEqual(booking.durationMinutes, 15);
    assert.strictEqual(booking.price, 0);
  });

  test('F5.3: Booking confirmation payload explicitly specifies "Gratuita" and "15 minutos"', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const booking = db.createBooking({
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'FREE_INTRO',
      scheduledAt: futureDate
    });

    // Confirmation UI data mapping
    const confirmationUI = {
      title: '¡Sesión Reservada con Éxito!',
      sessionTypeLabel: booking.label,
      durationDisplay: `${booking.durationMinutes} minutos`,
      costDisplay: booking.price === 0 ? '$0.00 (Gratuita)' : `$${booking.price.toFixed(2)}`
    };

    assert.strictEqual(confirmationUI.sessionTypeLabel, 'Gratuita');
    assert.strictEqual(confirmationUI.durationDisplay, '15 minutos');
    assert.ok(confirmationUI.costDisplay.includes('Gratuita'));
  });

  test('F5.4: Booking status is CONFIRMED immediately without requiring payment gateway', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const booking = db.createBooking({
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'FREE_INTRO',
      scheduledAt: futureDate
    });

    assert.strictEqual(booking.status, 'CONFIRMED');
    assert.ok(booking.id.startsWith('bk-'));
  });

  test('F5.5: Created booking is retrievable in coach schedule and student records', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const booking = db.createBooking({
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'FREE_INTRO',
      scheduledAt: futureDate
    });

    const recorded = db.bookings.find((b) => b.id === booking.id);
    assert.ok(recorded, 'Booking must be recorded in database');
    assert.strictEqual(recorded.studentId, 'student-1');
    assert.strictEqual(recorded.coachId, 'coach-1');
  });
});
