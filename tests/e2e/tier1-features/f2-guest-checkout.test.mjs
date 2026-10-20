// tests/e2e/tier1-features/f2-guest-checkout.test.mjs
// F2: Guest Checkout Redirect (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R1, PROJECT.md F2, M1

import { describe, test, assert } from '../harness/runner.mjs';
import { MiddlewareSimulator } from '../harness/mock-env.mjs';

describe('F2: Guest Checkout Redirect', { tier: 'tier1' }, () => {
  test('F2.1: Visiting /checkout unauthenticated returns 307 redirect to login', () => {
    const req = {
      pathname: '/checkout',
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307, 'Should return HTTP 307 Temporary Redirect');
    assert.ok(res.redirect.startsWith('/?auth=login'), 'Redirect URL must target /?auth=login');
  });

  test('F2.2: Visiting /checkout?courseId=course-101 preserves courseId in callbackUrl', () => {
    const searchParams = new URLSearchParams({ courseId: 'course-101' });
    const req = {
      pathname: '/checkout',
      searchParams,
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307);
    const targetUrl = new URL(res.redirect, 'http://localhost');
    assert.strictEqual(targetUrl.searchParams.get('auth'), 'login');
    assert.strictEqual(targetUrl.searchParams.get('callbackUrl'), '/checkout?courseId=course-101');
  });

  test('F2.3: Visiting /checkout with direct=true preserves direct flag in callbackUrl', () => {
    const searchParams = new URLSearchParams({ courseId: 'course-101', direct: 'true' });
    const req = {
      pathname: '/checkout',
      searchParams,
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307);
    const targetUrl = new URL(res.redirect, 'http://localhost');
    const callback = targetUrl.searchParams.get('callbackUrl');
    assert.ok(callback.includes('courseId=course-101'), 'callbackUrl must contain courseId');
    assert.ok(callback.includes('direct=true'), 'callbackUrl must contain direct=true flag');
  });

  test('F2.4: Authenticated student with session cookie accesses /checkout directly', () => {
    const req = {
      pathname: '/checkout',
      searchParams: new URLSearchParams({ courseId: 'course-101' }),
      cookies: {
        'cfh_session': 'valid-student-session-sha256',
        'cfh_active_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 200, 'Authenticated student must not be redirected away from checkout');
    assert.strictEqual(res.action, 'next', 'Should continue to render checkout page');
  });

  test('F2.5: Authenticated NextAuth session token allows direct /checkout access', () => {
    const req = {
      pathname: '/checkout',
      searchParams: new URLSearchParams({ courseId: 'course-101' }),
      cookies: {
        'next-auth.session-token': 'valid-nextauth-jwt',
        'cfh_user_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 200, 'NextAuth authenticated session must permit /checkout');
    assert.strictEqual(res.action, 'next');
  });
});
