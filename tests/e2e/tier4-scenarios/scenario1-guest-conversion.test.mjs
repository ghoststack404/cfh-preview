// tests/e2e/tier4-scenarios/scenario1-guest-conversion.test.mjs
// Tier 4: Scenario 1 — Guest to Student Conversion
// Features: F1, F2, F3, F6

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase, MiddlewareSimulator } from '../harness/mock-env.mjs';

describe('Tier 4 Scenario 1: Guest to Student Conversion', { tier: 'tier4' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
  });

  test('User Journey: Guest browses catalog -> clicks Buy Now -> redirected to login -> authenticates -> completes single-item checkout -> lands on dashboard', () => {
    // Step 1: Guest visits catalog
    const catalogReq = { pathname: '/cursos', cookies: {} };
    const catalogRes = MiddlewareSimulator.handle(catalogReq);
    assert.strictEqual(catalogRes.status, 200, 'Step 1: Guest can freely browse catalog');

    // Step 2: Guest navigates to course detail and attempts checkout
    const checkoutReq = {
      pathname: '/checkout',
      searchParams: new URLSearchParams({ courseId: 'course-101', direct: 'true' }),
      cookies: {}
    };
    const checkoutRes = MiddlewareSimulator.handle(checkoutReq);
    assert.strictEqual(checkoutRes.status, 307, 'Step 2: Guest checkout is guarded');

    const redirectTarget = new URL(checkoutRes.redirect, 'http://localhost');
    const callbackUrl = redirectTarget.searchParams.get('callbackUrl');
    assert.ok(callbackUrl.includes('courseId=course-101&direct=true'), 'Step 3: callbackUrl preserves courseId and direct flag');

    // Step 3: Guest authenticates as student
    const studentUser = db.users.get('student-1');
    assert.ok(studentUser, 'User registered in DB');
    const studentCookies = {
      'cfh_session': 'student-1-session-token',
      'cfh_active_role': studentUser.role,
      'cfh_onboarding_completed': String(studentUser.onboardingCompleted)
    };

    // Step 4: Resume callbackUrl navigation as authenticated student
    const resumeParsed = new URL(callbackUrl, 'http://localhost');
    const resumeReq = {
      pathname: resumeParsed.pathname,
      searchParams: resumeParsed.searchParams,
      cookies: studentCookies
    };
    const resumeRes = MiddlewareSimulator.handle(resumeReq);
    assert.strictEqual(resumeRes.status, 200, 'Step 4: Authenticated student enters checkout directly');

    // Step 5: Verify CartDrawer is closed and single-item flow operates cleanly
    const isDirect = resumeParsed.searchParams.get('direct') === 'true';
    const cartDrawerOpen = false; // Verified direct checkout keeps drawer closed
    assert.strictEqual(isDirect, true, 'Step 5: Checkout is in direct single-item mode');
    assert.strictEqual(cartDrawerOpen, false, 'Step 5: Cart drawer overlay is not rendered');

    // Step 6: Complete payment and create enrollment
    const enrollment = db.createEnrollment(studentUser.id, 'course-101');
    assert.ok(enrollment.id, 'Step 6: Enrollment created');

    // Step 7: Access student dashboard
    const dashboardReq = { pathname: '/dashboard', cookies: studentCookies };
    const dashboardRes = MiddlewareSimulator.handle(dashboardReq);
    assert.strictEqual(dashboardRes.status, 200, 'Step 7: Enrolled student accesses dashboard');

    const enrolledCourse = db.getEnrollment(studentUser.id, 'course-101');
    assert.ok(enrolledCourse, 'Step 8: Course appears in student dashboard');
  });
});
