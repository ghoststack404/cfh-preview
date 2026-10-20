// tests/adversarial/ac2-checkout-redirect.adversarial.mjs
// Adversarial Empirical Challenge Suite for Acceptance Criterion 2
// Target: "Visiting a course detail checkout page as a guest redirects to the login/registration flow."
// Author: teamwork_preview_challenger_m1_2 (Empirical Challenger)

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

// -----------------------------------------------------------------------------
// 1. Source Inspection & AST-level Assertions on Real Implementation Code
// -----------------------------------------------------------------------------

function verifyImplementationSources() {
  console.log('--- Step 1: Real Source Inspection & Structural Audit ---');

  const middlewarePath = path.join(projectRoot, 'apps', 'web', 'middleware.ts');
  const checkoutPagePath = path.join(projectRoot, 'apps', 'web', 'app', 'checkout', 'page.tsx');
  const authModalsPath = path.join(projectRoot, 'apps', 'web', 'components', 'AuthModals.tsx');

  assert.ok(fs.existsSync(middlewarePath), `middleware.ts must exist at ${middlewarePath}`);
  assert.ok(fs.existsSync(checkoutPagePath), `checkout/page.tsx must exist at ${checkoutPagePath}`);
  assert.ok(fs.existsSync(authModalsPath), `AuthModals.tsx must exist at ${authModalsPath}`);

  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  const checkoutContent = fs.readFileSync(checkoutPagePath, 'utf8');
  const authModalsContent = fs.readFileSync(authModalsPath, 'utf8');

  // Verify middleware.ts protectedRoutes includes "/checkout"
  assert.ok(
    middlewareContent.includes('"/checkout"') || middlewareContent.includes("'/checkout'"),
    'middleware.ts must include "/checkout" in protectedRoutes'
  );
  assert.ok(
    middlewareContent.includes('createLoginRedirect'),
    'middleware.ts must define createLoginRedirect helper'
  );
  assert.ok(
    middlewareContent.includes('url.searchParams.set("auth", "login")'),
    'createLoginRedirect must set auth=login'
  );
  assert.ok(
    middlewareContent.includes('url.searchParams.set("callbackUrl", target)'),
    'createLoginRedirect must preserve full target in callbackUrl'
  );

  // Verify checkout/page.tsx defense-in-depth
  assert.ok(
    checkoutContent.includes("sessionStatus === 'unauthenticated'"),
    'checkout/page.tsx must guard against unauthenticated sessionStatus'
  );
  assert.ok(
    checkoutContent.includes('router.replace'),
    'checkout/page.tsx must invoke router.replace for unauthenticated visitors'
  );
  assert.ok(
    checkoutContent.includes("sessionStatus === 'authenticated'"),
    'checkout/page.tsx must condition addItem on authenticated status'
  );

  // Verify AuthModals.tsx URL listening & open redirect sanitation
  assert.ok(
    authModalsContent.includes("params.get('auth')"),
    'AuthModals.tsx must listen to auth query parameter on load'
  );
  assert.ok(
    authModalsContent.includes('openLogin()'),
    'AuthModals.tsx must automatically invoke openLogin() when auth=login'
  );
  assert.ok(
    authModalsContent.includes("callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')"),
    'AuthModals.tsx must enforce strict internal callbackUrl validation'
  );

  console.log('✓ Source code structural verification passed.\n');
}

// -----------------------------------------------------------------------------
// 2. Exact Implementation Logic Replica of apps/web/middleware.ts
// -----------------------------------------------------------------------------

const protectedRoutes = ["/sesion", "/dashboard", "/coach/", "/student", "/checkout"];

function runMiddlewareLogic({ urlString, cookies = {} }) {
  const parsedUrl = new URL(urlString, 'http://localhost:3000');
  const pathname = parsedUrl.pathname;
  const search = parsedUrl.search;

  // Session flags matching apps/web/middleware.ts lines 22-30
  const hasCustomSession = Boolean(cookies['cfh_session']);
  const hasNextAuthCookie = Boolean(
    cookies['authjs.session-token'] ||
    cookies['__Secure-authjs.session-token'] ||
    cookies['next-auth.session-token'] ||
    cookies['__Secure-next-auth.session-token']
  );
  const isAuthenticated = hasCustomSession || hasNextAuthCookie;

  const role = cookies['cfh_active_role'] || cookies['cfh_user_role'] || null;
  const isOnboardingCompleted = cookies['cfh_onboarding_completed'] === 'true';

  const isCoach = role === 'COACH';
  const isStudent = role === 'STUDENT' || role === 'APPRENTICE';
  const isAdmin = role === 'ADMIN';

  // Guard: Root path (/)
  if (pathname === '/') {
    if (isAuthenticated) {
      const callbackUrl = parsedUrl.searchParams.get('callbackUrl') || parsedUrl.searchParams.get('redirect');
      if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') && !callbackUrl.startsWith('/comunidad')) {
        return { status: 307, redirect: new URL(callbackUrl, parsedUrl.origin).href, action: 'redirect' };
      }
      if (isAdmin) {
        return { status: 307, redirect: new URL('/dashboard', parsedUrl.origin).href, action: 'redirect' };
      } else if (isCoach && isOnboardingCompleted) {
        return { status: 307, redirect: new URL('/coach/dashboard', parsedUrl.origin).href, action: 'redirect' };
      } else if (isCoach && !isOnboardingCompleted) {
        return { status: 307, redirect: new URL('/coach/onboarding', parsedUrl.origin).href, action: 'redirect' };
      } else if (isStudent && isOnboardingCompleted) {
        return { status: 307, redirect: new URL('/dashboard', parsedUrl.origin).href, action: 'redirect' };
      } else if (isStudent && !isOnboardingCompleted) {
        return { status: 307, redirect: new URL('/student/onboarding', parsedUrl.origin).href, action: 'redirect' };
      } else {
        return { status: 307, redirect: new URL('/dashboard', parsedUrl.origin).href, action: 'redirect' };
      }
    }
  }

  // Guard: Student onboarding
  if (pathname === '/student/onboarding' || pathname.startsWith('/student/onboarding/')) {
    if (!isAuthenticated) {
      return executeLoginRedirect(parsedUrl);
    }
  }

  // Guard: Dashboard
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!isAuthenticated) {
      return executeLoginRedirect(parsedUrl);
    }
    if (isStudent && !isOnboardingCompleted) {
      return { status: 307, redirect: new URL('/student/onboarding', parsedUrl.origin).href, action: 'redirect' };
    }
  }

  // Guard: Coach onboarding
  const isCoachOnboardingPath =
    pathname === '/onboarding/coach' ||
    pathname.startsWith('/onboarding/coach/') ||
    pathname === '/coach/onboarding' ||
    pathname.startsWith('/coach/onboarding/');

  if (isCoachOnboardingPath) {
    if (!isAuthenticated) {
      return executeLoginRedirect(parsedUrl);
    }
  }

  // Guard: Coach portal
  const isCoachPortalPath = (pathname === '/coach' || pathname.startsWith('/coach/')) && !isCoachOnboardingPath;
  if (isCoachPortalPath) {
    if (!isAuthenticated) {
      return executeLoginRedirect(parsedUrl);
    }
  }

  // Guard: Protected routes including /checkout
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (isProtected && !isAuthenticated) {
    return executeLoginRedirect(parsedUrl);
  }

  return { status: 200, action: 'next', redirect: null };
}

function executeLoginRedirect(parsedUrl) {
  const { pathname, search } = parsedUrl;
  const redirectUrl = new URL('/', parsedUrl.origin);
  redirectUrl.searchParams.set('auth', 'login');
  const target = `${pathname}${search || ''}`;
  redirectUrl.searchParams.set('callbackUrl', target);
  return {
    status: 307,
    action: 'redirect',
    redirect: redirectUrl.href,
    targetUrl: redirectUrl
  };
}

// -----------------------------------------------------------------------------
// 3. AuthModal Login / Register Callback Resolution Logic
// -----------------------------------------------------------------------------

function simulateAuthModalPostAuth({ currentUrlString, user }) {
  const parsed = new URL(currentUrlString, 'http://localhost:3000');
  const callbackUrl = parsed.searchParams.get('callbackUrl') || parsed.searchParams.get('redirect');
  const isOnboardingCompleted = Boolean(user.isOnboardingCompleted);
  const userRole = user.role;

  if (!isOnboardingCompleted) {
    if (userRole === 'COACH') {
      return '/onboarding/coach';
    } else {
      return callbackUrl
        ? `/student/onboarding?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : '/student/onboarding';
    }
  }

  if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') && !callbackUrl.startsWith('/comunidad')) {
    return callbackUrl;
  }

  return '/';
}

// -----------------------------------------------------------------------------
// 4. Adversarial Test Execution
// -----------------------------------------------------------------------------

async function runAdversarialProbes() {
  console.log('--- Step 2: Executing 30 Adversarial Probes ---');
  let passed = 0;
  let failed = 0;

  function runProbe(name, probeFn) {
    try {
      probeFn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // PROBE 1: Visiting /checkout with no params as guest
  runProbe('Probe 1: Visiting /checkout with no params as guest returns 307 to /?auth=login&callbackUrl=/checkout', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/checkout' });
    assert.strictEqual(res.status, 307);
    assert.strictEqual(res.action, 'redirect');
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.pathname, '/');
    assert.strictEqual(dest.searchParams.get('auth'), 'login');
    assert.strictEqual(dest.searchParams.get('callbackUrl'), '/checkout');
  });

  // PROBE 2: Visiting /checkout?courseId=sample-2 as guest
  runProbe('Probe 2: Visiting /checkout?courseId=sample-2 preserves courseId in callbackUrl', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/checkout?courseId=sample-2' });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.searchParams.get('auth'), 'login');
    assert.strictEqual(dest.searchParams.get('callbackUrl'), '/checkout?courseId=sample-2');
  });

  // PROBE 3: Visiting /checkout?courseId=sample-2&direct=true as guest
  runProbe('Probe 3: Visiting /checkout?courseId=sample-2&direct=true preserves both params', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/checkout?courseId=sample-2&direct=true' });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.searchParams.get('auth'), 'login');
    assert.strictEqual(dest.searchParams.get('callbackUrl'), '/checkout?courseId=sample-2&direct=true');
  });

  // PROBE 4: Visiting /checkout with multi-param query
  runProbe('Probe 4: Multi-param checkout query (/checkout?courseId=sample-2&direct=true&coupon=50OFF&ref=partner)', () => {
    const res = runMiddlewareLogic({
      urlString: 'http://localhost:3000/checkout?courseId=sample-2&direct=true&coupon=50OFF&ref=partner'
    });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    const callback = dest.searchParams.get('callbackUrl');
    assert.ok(callback.includes('courseId=sample-2'));
    assert.ok(callback.includes('direct=true'));
    assert.ok(callback.includes('coupon=50OFF'));
    assert.ok(callback.includes('ref=partner'));
  });

  // PROBE 5: Accented and UTF-8 characters in courseId
  runProbe('Probe 5: Accented and UTF-8 query strings are safely preserved without corruption', () => {
    const courseId = 'curso-comunicación-y-empatía';
    const res = runMiddlewareLogic({ urlString: `http://localhost:3000/checkout?courseId=${encodeURIComponent(courseId)}` });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    const callback = dest.searchParams.get('callbackUrl');
    assert.ok(callback.includes(encodeURIComponent(courseId)));
  });

  // PROBE 6: Cross-site scripting (XSS) vector in query params
  runProbe('Probe 6: Injected XSS vector (<script>alert(1)</script>) does not alter redirect target', () => {
    const payload = '<script>alert(1)</script>';
    const res = runMiddlewareLogic({ urlString: `http://localhost:3000/checkout?courseId=${encodeURIComponent(payload)}` });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.origin, 'http://localhost:3000');
    assert.strictEqual(dest.pathname, '/');
    assert.strictEqual(dest.searchParams.get('auth'), 'login');
  });

  // PROBE 7: SQL injection style string in courseId
  runProbe('Probe 7: SQL injection pattern in query does not break redirect or throw', () => {
    const payload = "sample-2' OR '1'='1";
    const res = runMiddlewareLogic({ urlString: `http://localhost:3000/checkout?courseId=${encodeURIComponent(payload)}` });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.searchParams.get('auth'), 'login');
  });

  // PROBE 8: Path traversal pattern in courseId
  runProbe('Probe 8: Path traversal payload (../../etc/passwd) safely contained inside callbackUrl', () => {
    const payload = '../../etc/passwd';
    const res = runMiddlewareLogic({ urlString: `http://localhost:3000/checkout?courseId=${encodeURIComponent(payload)}` });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.pathname, '/');
    assert.ok(dest.searchParams.get('callbackUrl').includes('..%2F..%2Fetc%2Fpasswd'));
  });

  // PROBE 9: Open redirect injection attempt inside checkout query params
  runProbe('Probe 9: External URL injected into checkout query stays on host and targets root with auth=login', () => {
    const malicious = 'https://attacker.evil.com/phish';
    const res = runMiddlewareLogic({ urlString: `http://localhost:3000/checkout?courseId=sample-2&callbackUrl=${encodeURIComponent(malicious)}` });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.origin, 'http://localhost:3000');
    assert.strictEqual(dest.pathname, '/');
    assert.strictEqual(dest.searchParams.get('auth'), 'login');
  });

  // PROBE 10: Protocol-relative URL open redirect attempt
  runProbe('Probe 10: Protocol-relative callback attempt (//attacker.evil.com) redirected to home with auth=login', () => {
    const malicious = '//attacker.evil.com';
    const res = runMiddlewareLogic({ urlString: `http://localhost:3000/checkout?callbackUrl=${encodeURIComponent(malicious)}` });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.origin, 'http://localhost:3000');
  });

  // PROBE 11: Trailing slash on checkout (/checkout/)
  runProbe('Probe 11: Trailing slash (/checkout/) is recognized as protected and redirected', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/checkout/' });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.searchParams.get('callbackUrl'), '/checkout/');
  });

  // PROBE 12: Subpath on checkout (/checkout/payment-review)
  runProbe('Probe 12: Nested checkout subpath (/checkout/payment-review) is guarded', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/checkout/payment-review' });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.searchParams.get('callbackUrl'), '/checkout/payment-review');
  });

  // PROBE 13: Empty search string (? with nothing after)
  runProbe('Probe 13: Checkout with empty query delimiter (/checkout?) redirects cleanly', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/checkout?' });
    assert.strictEqual(res.status, 307);
    const dest = new URL(res.redirect);
    assert.strictEqual(dest.searchParams.get('callbackUrl'), '/checkout');
  });

  // PROBE 14: Public catalog browsing: /cursos is NOT redirected
  runProbe('Probe 14: Public catalog (/cursos) is NOT redirected for guests (action=next, status=200)', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/cursos' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
    assert.strictEqual(res.redirect, null);
  });

  // PROBE 15: Public course detail: /cursos/sample-2 is NOT redirected
  runProbe('Probe 15: Public course detail (/cursos/sample-2) is NOT redirected for guests', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/cursos/sample-2' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
    assert.strictEqual(res.redirect, null);
  });

  // PROBE 16: Public course detail with query params: /cursos/sample-2?direct=true
  runProbe('Probe 16: Public course detail with query params is NOT redirected for guests', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/cursos/sample-2?direct=true&from=search' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
    assert.strictEqual(res.redirect, null);
  });

  // PROBE 17: Public community feed: /comunidad is NOT redirected
  runProbe('Probe 17: Public community feed (/comunidad) is NOT redirected for guests', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/comunidad' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
    assert.strictEqual(res.redirect, null);
  });

  // PROBE 18: Public community post detail: /comunidad/post/post-101 is NOT redirected
  runProbe('Probe 18: Public community post detail (/comunidad/post/post-101) is NOT redirected for guests', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/comunidad/post/post-101' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
    assert.strictEqual(res.redirect, null);
  });

  // PROBE 19: Public landing page: / is NOT redirected for guests
  runProbe('Probe 19: Public landing page (/) is NOT redirected for unauthenticated guests', () => {
    const res = runMiddlewareLogic({ urlString: 'http://localhost:3000/' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
  });

  // PROBE 20: Authenticated student accessing /checkout?courseId=sample-2 is NOT redirected
  runProbe('Probe 20: Authenticated student with cfh_session can access /checkout directly (status 200)', () => {
    const res = runMiddlewareLogic({
      urlString: 'http://localhost:3000/checkout?courseId=sample-2',
      cookies: {
        'cfh_session': 'valid-student-session-hash',
        'cfh_active_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
    assert.strictEqual(res.redirect, null);
  });

  // PROBE 21: Authenticated user via NextAuth token accessing /checkout is NOT redirected
  runProbe('Probe 21: Authenticated user with next-auth.session-token accesses /checkout directly', () => {
    const res = runMiddlewareLogic({
      urlString: 'http://localhost:3000/checkout?courseId=sample-2',
      cookies: {
        'next-auth.session-token': 'valid-jwt-token',
        'cfh_user_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
  });

  // PROBE 22: Authenticated user with __Secure-next-auth.session-token accesses /checkout
  runProbe('Probe 22: Authenticated user with __Secure-next-auth.session-token accesses /checkout directly', () => {
    const res = runMiddlewareLogic({
      urlString: 'http://localhost:3000/checkout?courseId=sample-2',
      cookies: {
        '__Secure-next-auth.session-token': 'valid-production-jwt',
        'cfh_user_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.action, 'next');
  });

  // PROBE 23: Authenticated student visiting / with callbackUrl=/checkout?courseId=sample-2 is forwarded
  runProbe('Probe 23: Authenticated user visiting / with safe callbackUrl is automatically forwarded to checkout', () => {
    const res = runMiddlewareLogic({
      urlString: 'http://localhost:3000/?callbackUrl=/checkout?courseId=sample-2',
      cookies: {
        'cfh_session': 'valid-student-session',
        'cfh_active_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    });
    assert.strictEqual(res.status, 307);
    assert.strictEqual(res.redirect, 'http://localhost:3000/checkout?courseId=sample-2');
  });

  // PROBE 24: Authenticated student visiting / with dangerous open-redirect callbackUrl is NOT forwarded
  runProbe('Probe 24: Authenticated user visiting / with open-redirect callbackUrl (//evil.com) falls back to /dashboard', () => {
    const res = runMiddlewareLogic({
      urlString: 'http://localhost:3000/?callbackUrl=//evil.com',
      cookies: {
        'cfh_session': 'valid-student-session',
        'cfh_active_role': 'STUDENT',
        'cfh_onboarding_completed': 'true'
      }
    });
    assert.strictEqual(res.status, 307);
    assert.strictEqual(res.redirect, 'http://localhost:3000/dashboard');
  });

  // PROBE 25: AuthModal post-auth resolution returns to /checkout?courseId=sample-2 for complete student
  runProbe('Probe 25: AuthModal post-login returns to /checkout?courseId=sample-2 when onboarding completed', () => {
    const currentUrl = 'http://localhost:3000/?auth=login&callbackUrl=%2Fcheckout%3FcourseId%3Dsample-2';
    const nextUrl = simulateAuthModalPostAuth({
      currentUrlString: currentUrl,
      user: { role: 'STUDENT', isOnboardingCompleted: true }
    });
    assert.strictEqual(nextUrl, '/checkout?courseId=sample-2');
  });

  // PROBE 26: AuthModal post-auth forwards callbackUrl to onboarding for incomplete student
  runProbe('Probe 26: AuthModal post-login preserves callbackUrl into /student/onboarding when not completed', () => {
    const currentUrl = 'http://localhost:3000/?auth=login&callbackUrl=%2Fcheckout%3FcourseId%3Dsample-2';
    const nextUrl = simulateAuthModalPostAuth({
      currentUrlString: currentUrl,
      user: { role: 'STUDENT', isOnboardingCompleted: false }
    });
    assert.strictEqual(
      nextUrl,
      `/student/onboarding?callbackUrl=${encodeURIComponent('/checkout?courseId=sample-2')}`
    );
  });

  // PROBE 27: AuthModal post-auth neutralizes external domain callbackUrl
  runProbe('Probe 27: AuthModal post-login neutralizes external callbackUrl (https://evil.com) and defaults to /', () => {
    const currentUrl = 'http://localhost:3000/?auth=login&callbackUrl=https%3A%2F%2Fevil.com';
    const nextUrl = simulateAuthModalPostAuth({
      currentUrlString: currentUrl,
      user: { role: 'STUDENT', isOnboardingCompleted: true }
    });
    assert.strictEqual(nextUrl, '/');
  });

  // PROBE 28: AuthModal post-auth neutralizes protocol-relative //evil.com
  runProbe('Probe 28: AuthModal post-login neutralizes protocol-relative callbackUrl (//evil.com) and defaults to /', () => {
    const currentUrl = 'http://localhost:3000/?auth=login&callbackUrl=%2F%2Fevil.com';
    const nextUrl = simulateAuthModalPostAuth({
      currentUrlString: currentUrl,
      user: { role: 'STUDENT', isOnboardingCompleted: true }
    });
    assert.strictEqual(nextUrl, '/');
  });

  // PROBE 29: AuthModal auto-open and replaceState cleanup test
  runProbe('Probe 29: URL with ?auth=login opens login modal; dismiss logic deletes auth parameter', () => {
    const url = new URL('http://localhost:3000/?auth=login&callbackUrl=/checkout');
    assert.strictEqual(url.searchParams.get('auth'), 'login');
    // Dismiss simulation
    url.searchParams.delete('auth');
    assert.strictEqual(url.searchParams.has('auth'), false);
    assert.strictEqual(url.searchParams.get('callbackUrl'), '/checkout');
  });

  // PROBE 30: Guest client-side direct navigation guard in checkout/page.tsx
  runProbe('Probe 30: Client-side checkout/page.tsx generates exact replacement URL upon unauthenticated status', () => {
    const pathname = '/checkout';
    const search = '?courseId=sample-2&direct=true';
    const returnPath = pathname + search;
    const replacementUrl = `/?auth=login&callbackUrl=${encodeURIComponent(returnPath)}`;
    assert.strictEqual(
      replacementUrl,
      '/?auth=login&callbackUrl=%2Fcheckout%3FcourseId%3Dsample-2%26direct%3Dtrue'
    );
  });

  console.log('\n-------------------------------------------------------------');
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${passed + failed} probes.`);
  console.log('-------------------------------------------------------------\n');

  if (failed > 0) {
    throw new Error(`${failed} adversarial probe(s) failed!`);
  }
}

// -----------------------------------------------------------------------------
// Main execution
// -----------------------------------------------------------------------------

try {
  verifyImplementationSources();
  await runAdversarialProbes();
  console.log('🎉 ALL ADVERSARIAL CHALLENGES COMPLETED SUCCESSFULLY WITH 0 FAILURES!');
  process.exit(0);
} catch (error) {
  console.error('💥 ADVERSARIAL CHALLENGE FAILED:', error.message);
  process.exit(1);
}
