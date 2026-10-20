// tests/e2e/tier1-features/f3-role-routing.test.mjs
// F3: Role-Based Routing & Unauth Browsing (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R1, PROJECT.md F3, M1

import { describe, test, assert } from '../harness/runner.mjs';
import { MiddlewareSimulator } from '../harness/mock-env.mjs';

describe('F3: Role-Based Routing & Unauth Browsing', { tier: 'tier1' }, () => {
  test('F3.1: Guest can browse public course catalog (/cursos) without redirect', () => {
    const req = {
      pathname: '/cursos',
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 200, 'Catalog must be publicly accessible');
    assert.strictEqual(res.action, 'next', 'Must proceed without redirect');
  });

  test('F3.2: Guest can browse community feed (/comunidad) read-only without redirect', () => {
    const req = {
      pathname: '/comunidad',
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 200, 'Community feed must be publicly viewable');
    assert.strictEqual(res.action, 'next', 'Must proceed without redirect');
  });

  test('F3.3: Guest visiting root path (/) sees landing page (no redirect)', () => {
    const req = {
      pathname: '/',
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 200, 'Landing page should render for guests');
    assert.strictEqual(res.action, 'next');
  });

  test('F3.4: Authenticated student visiting root path (/) is redirected to /dashboard', () => {
    const req = {
      pathname: '/',
      cookies: {
        'cfh_session': 'valid-student-session',
        'cfh_active_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307, 'Should redirect student away from root');
    assert.strictEqual(res.redirect, '/dashboard', 'Student should be redirected to /dashboard');
  });

  test('F3.5: Authenticated coach visiting root path (/) is redirected to /coach/dashboard', () => {
    const req = {
      pathname: '/',
      cookies: {
        'cfh_session': 'valid-coach-session',
        'cfh_active_role': 'COACH',
        'cfh_onboarding_completed': 'true'
      }
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307, 'Should redirect coach away from root');
    assert.strictEqual(res.redirect, '/coach/dashboard', 'Coach should be redirected to /coach/dashboard');
  });
});
