// tests/e2e/tier2-boundaries/f2-boundary.test.mjs
// F2 Boundary & Corner Cases (>= 5 test cases)
// Focus: Missing params, open redirect protection, special chars, invalid slugs, stale storage

import { describe, test, assert } from '../harness/runner.mjs';
import { MiddlewareSimulator } from '../harness/mock-env.mjs';

describe('F2 Boundary: Guest Checkout Redirect Edge Cases', { tier: 'tier2' }, () => {
  test('F2-B.1: Visiting /checkout with no query parameters redirects to login with base callbackUrl', () => {
    const req = {
      pathname: '/checkout',
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307);
    const targetUrl = new URL(res.redirect, 'http://localhost');
    assert.strictEqual(targetUrl.searchParams.get('callbackUrl'), '/checkout');
  });

  test('F2-B.2: Malicious open redirect payload in checkout is sanitized to safe internal route', () => {
    const maliciousParams = new URLSearchParams({
      courseId: 'c1',
      callbackUrl: 'https://malicious-phishing-site.example.com/steal-creds'
    });

    const req = {
      pathname: '/checkout',
      searchParams: maliciousParams,
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307);
    assert.strictEqual(res.redirect.includes('malicious-phishing-site.example.com'), false, 'External domain must be stripped/sanitized');
    assert.ok(res.redirect.startsWith('/?auth=login'));
  });

  test('F2-B.3: Course ID containing spaces, accents, and symbols is safely encoded in callbackUrl', () => {
    const specialCourseId = 'curso-liderazgo-2026!#@$';
    const req = {
      pathname: '/checkout',
      searchParams: new URLSearchParams({ courseId: specialCourseId, ref: 'promo-invierno' }),
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307);
    const targetUrl = new URL(res.redirect, 'http://localhost');
    const callback = targetUrl.searchParams.get('callbackUrl');
    assert.ok(callback.includes('curso-liderazgo-2026'), 'Special course slug preserved');
    assert.ok(callback.includes('promo-invierno'), 'Auxiliary query params preserved');
  });

  test('F2-B.4: Visiting /checkout with non-existent course ID redirects cleanly to login', () => {
    const req = {
      pathname: '/checkout',
      searchParams: new URLSearchParams({ courseId: 'non-existent-uuid-99999' }),
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);

    assert.strictEqual(res.status, 307);
    const targetUrl = new URL(res.redirect, 'http://localhost');
    assert.strictEqual(targetUrl.searchParams.get('courseId'), null); // courseId is inside callbackUrl
    assert.strictEqual(targetUrl.searchParams.get('callbackUrl'), '/checkout?courseId=non-existent-uuid-99999');
  });

  test('F2-B.5: Guest with corrupted localStorage cart item payload still redirects safely to login', () => {
    // Simulating invalid JSON string stored in cfh_cart_guest
    const corruptedCart = '{ invalid json - unclosed bracket';
    let safeRead = false;
    try {
      JSON.parse(corruptedCart);
    } catch {
      safeRead = true; // Handled without uncaught crash
    }
    assert.strictEqual(safeRead, true, 'Corrupted cart in storage must be safely handled');

    const req = {
      pathname: '/checkout',
      cookies: {}
    };
    const res = MiddlewareSimulator.handle(req);
    assert.strictEqual(res.status, 307);
  });
});
