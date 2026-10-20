// tests/e2e/tier4-scenarios/scenario2-coaching-intake.test.mjs
// Tier 4: Scenario 2 — Free Coaching Intake & Course Onboarding
// Features: F4, F5, F7

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase } from '../harness/mock-env.mjs';

describe('Tier 4 Scenario 2: Free Coaching Intake & Course Onboarding', { tier: 'tier4' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
  });

  test('User Journey: Student selects coach -> books 15-min free intro -> verifies Gratuita confirmation -> inspects dashboard agenda -> starts course in classroom', () => {
    const studentId = 'student-1';
    const coachId = 'coach-1';

    // Step 1: Verify coach profile free intro parameters
    const coach = db.users.get(coachId);
    assert.strictEqual(coach.freeIntroEnabled, true, 'Step 1: Coach enables free intro');
    assert.strictEqual(coach.freeIntroMinutes, 15, 'Step 1: Coach free intro is 15 minutes');

    // Step 2: Check student eligibility
    const eligibility = db.checkFreeIntroEligibility(studentId, coachId);
    assert.strictEqual(eligibility.eligible, true, 'Step 2: Student is eligible for free session');
    assert.strictEqual(eligibility.durationMinutes, 15);
    assert.strictEqual(eligibility.price, 0);

    // Step 3: Book the 15-minute free intro session
    const scheduledTime = new Date(Date.now() + 86400000).toISOString();
    const booking = db.createBooking({
      studentId,
      coachId,
      type: 'FREE_INTRO',
      scheduledAt: scheduledTime
    });

    assert.strictEqual(booking.type, 'FREE_INTRO', 'Step 3: Booking record is FREE_INTRO');
    assert.strictEqual(booking.durationMinutes, 15, 'Step 3: Duration is 15 minutes');
    assert.strictEqual(booking.price, 0, 'Step 3: Price is $0.00');
    assert.strictEqual(booking.label, 'Gratuita', 'Step 3: Label is Gratuita');

    // Step 4: Verify student dashboard agenda reflects the new session
    const studentBookings = db.bookings.filter((b) => b.studentId === studentId);
    assert.strictEqual(studentBookings.length, 1, 'Step 4: Booking recorded for student');
    assert.strictEqual(studentBookings[0].durationMinutes, 15);
    assert.strictEqual(studentBookings[0].label, 'Gratuita');

    // Step 5: Student enrolls in and accesses course onboarding
    db.createEnrollment(studentId, 'course-101');
    const enrollment = db.getEnrollment(studentId, 'course-101');
    assert.ok(enrollment, 'Step 5: Enrolled in course');

    // Step 6: Mark first lesson complete in classroom player
    const progressRes = db.setLessonProgress(studentId, 'course-101', 'les-1', true);
    assert.strictEqual(progressRes.success, true, 'Step 6: First lesson completed');
    assert.strictEqual(enrollment.progress.has('les-1'), true, 'Step 6: Progress persisted in database');
  });
});
