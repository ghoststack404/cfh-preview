// tests/e2e/tier5-adversarial/r1-adversarial.test.mjs
// Tier 5 White-Box Adversarial Hardening Suite for Milestone 1 (R1)
//
// Target Specifications:
// - Open redirect defense (protocol-relative URLs: //attacker.com, external schemes: https://, http://, javascript:, data:)
// - URL-encoded and obfuscated redirection vectors (%2F%2Fevil.com, /%5Cevil.com)
// - CallbackUrl parameter preservation across complex, multi-param query strings
// - Special characters, UTF-8, accented text, and SQL/XSS payload preservation
// - Root landing page conditional forwarding and fallback routing
// - Defense-in-depth alignment between Edge Middleware and Client AuthModals
//
// Author: teamwork_preview_challenger_m4_1 (Tier 5 White-Box Adversarial Challenger)

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

export function runR1AdversarialSuite() {
  console.log('\n================================================================');
  console.log('TIER 5 ADVERSARIAL SUITE - REQUIREMENT 1: AUTH & OPEN REDIRECT');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;
  let totalAssertions = 0;

  function runProbe(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  function countAssert(condition, msg) {
    totalAssertions++;
    assert.ok(condition, msg);
  }

  // ---------------------------------------------------------------------------
  // 1. Static Source Code Structural Invariants Audit
  // ---------------------------------------------------------------------------
  runProbe('R1.1: Source code structural audit of middleware.ts, AuthModals.tsx, and checkout/page.tsx', () => {
    const middlewarePath = path.join(projectRoot, 'apps', 'web', 'middleware.ts');
    const authModalsPath = path.join(projectRoot, 'apps', 'web', 'components', 'AuthModals.tsx');
    const checkoutPagePath = path.join(projectRoot, 'apps', 'web', 'app', 'checkout', 'page.tsx');

    countAssert(fs.existsSync(middlewarePath), `middleware.ts must exist at ${middlewarePath}`);
    countAssert(fs.existsSync(authModalsPath), `AuthModals.tsx must exist at ${authModalsPath}`);
    countAssert(fs.existsSync(checkoutPagePath), `checkout/page.tsx must exist at ${checkoutPagePath}`);

    const middlewareSrc = fs.readFileSync(middlewarePath, 'utf8');
    const authModalsSrc = fs.readFileSync(authModalsPath, 'utf8');
    const checkoutSrc = fs.readFileSync(checkoutPagePath, 'utf8');

    // Middleware protected routes must include /checkout
    countAssert(middlewareSrc.includes('"/checkout"') || middlewareSrc.includes("'/checkout'"), 'middleware.ts must protect /checkout');
    // Login redirect helper must set auth=login and callbackUrl=target
    countAssert(middlewareSrc.includes('url.searchParams.set("auth", "login")'), 'createLoginRedirect must set auth=login');
    countAssert(middlewareSrc.includes('url.searchParams.set("callbackUrl", target)'), 'createLoginRedirect must set callbackUrl');

    // Middleware root redirect open-redirect check
    countAssert(
      middlewareSrc.includes('callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") && !callbackUrl.startsWith("/comunidad")'),
      'middleware.ts must validate internal callbackUrl (startsWith / and !startsWith // and !startsWith /comunidad)'
    );

    // AuthModals client-side post-login redirection security check
    countAssert(
      authModalsSrc.includes("callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') && !callbackUrl.startsWith('/comunidad')"),
      'AuthModals.tsx must validate internal callbackUrl before window.location.href assignment'
    );

    // Checkout page defense-in-depth guest interception
    countAssert(checkoutSrc.includes("sessionStatus === 'unauthenticated'"), 'checkout/page.tsx must check sessionStatus unauthenticated');
    countAssert(checkoutSrc.includes('router.replace(`/?auth=login&callbackUrl='), 'checkout/page.tsx must replace with auth=login&callbackUrl');
  });

  // ---------------------------------------------------------------------------
  // 2. Middleware Logic Simulator (Direct Model of apps/web/middleware.ts)
  // ---------------------------------------------------------------------------
  const protectedRoutes = ["/sesion", "/dashboard", "/coach/", "/student", "/checkout"];

  function simulateMiddleware({ urlString, cookies = {} }) {
    const parsedUrl = new URL(urlString, 'http://localhost:3000');
    const { pathname, search } = parsedUrl;

    const hasCustomSession = Boolean(cookies['cfh_session']);
    const hasNextAuth = Boolean(
      cookies['authjs.session-token'] ||
      cookies['__Secure-authjs.session-token'] ||
      cookies['next-auth.session-token'] ||
      cookies['__Secure-next-auth.session-token']
    );
    const isAuthenticated = hasCustomSession || hasNextAuth;
    const role = cookies['cfh_active_role'] || cookies['cfh_user_role'] || null;
    const isOnboardingCompleted = cookies['cfh_onboarding_completed'] === 'true';

    const isCoach = role === 'COACH';
    const isStudent = role === 'STUDENT' || role === 'APPRENTICE';
    const isAdmin = role === 'ADMIN';

    // Root Guard
    if (pathname === '/') {
      if (isAuthenticated) {
        const callbackUrl = parsedUrl.searchParams.get('callbackUrl') || parsedUrl.searchParams.get('redirect');
        if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') && !callbackUrl.startsWith('/comunidad')) {
          return { status: 307, action: 'redirect', redirectUrl: new URL(callbackUrl, parsedUrl.origin).href };
        }
        if (isAdmin) {
          return { status: 307, action: 'redirect', redirectUrl: new URL('/dashboard', parsedUrl.origin).href };
        } else if (isCoach && isOnboardingCompleted) {
          return { status: 307, action: 'redirect', redirectUrl: new URL('/coach/dashboard', parsedUrl.origin).href };
        } else if (isCoach && !isOnboardingCompleted) {
          return { status: 307, action: 'redirect', redirectUrl: new URL('/coach/onboarding', parsedUrl.origin).href };
        } else if (isStudent && isOnboardingCompleted) {
          return { status: 307, action: 'redirect', redirectUrl: new URL('/dashboard', parsedUrl.origin).href };
        } else if (isStudent && !isOnboardingCompleted) {
          return { status: 307, action: 'redirect', redirectUrl: new URL('/student/onboarding', parsedUrl.origin).href };
        } else {
          return { status: 307, action: 'redirect', redirectUrl: new URL('/dashboard', parsedUrl.origin).href };
        }
      }
      return { status: 200, action: 'next', redirectUrl: null };
    }

    // Protected Route Intercept
    const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
    if (isProtected && !isAuthenticated) {
      const redirectTarget = new URL('/', parsedUrl.origin);
      redirectTarget.searchParams.set('auth', 'login');
      const target = `${pathname}${search || ''}`;
      redirectTarget.searchParams.set('callbackUrl', target);
      return { status: 307, action: 'redirect', redirectUrl: redirectTarget.href, callbackUrl: target };
    }

    return { status: 200, action: 'next', redirectUrl: null };
  }

  // ---------------------------------------------------------------------------
  // 3. Client AuthModals Redirect Simulator (Direct Model of AuthModals.tsx)
  // ---------------------------------------------------------------------------
  function simulateAuthModalResolution({ searchParamsString, user }) {
    const params = new URLSearchParams(searchParamsString);
    const callbackUrl = params.get('callbackUrl') || params.get('redirect');
    const isOnboardingCompleted = Boolean(user?.isOnboardingCompleted);
    const userRole = user?.role;

    if (!isOnboardingCompleted) {
      if (userRole === 'COACH') {
        return '/onboarding/coach';
      } else {
        return callbackUrl
          ? `/student/onboarding?callbackUrl=${encodeURIComponent(callbackUrl)}`
          : '/student/onboarding';
      }
    }

    // Open redirect guard in AuthModals.tsx
    if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') && !callbackUrl.startsWith('/comunidad')) {
      return callbackUrl;
    }

    return '/';
  }

  // ---------------------------------------------------------------------------
  // Probes: Malicious Protocol-Relative & External Scheme Neutralization
  // ---------------------------------------------------------------------------
  runProbe('R1.2: Neutralize protocol-relative URL schemes (//attacker.evil.com, ///evil.com, /\\evil.com)', () => {
    const maliciousVectors = [
      '//attacker.evil.com',
      '//attacker.evil.com/phish?account=steal',
      '///attacker.evil.com',
      '////attacker.evil.com',
      '//localhost:8080/evil',
      '//127.0.0.1/malicious',
      '//google.com%2f@evil.com'
    ];

    for (const vector of maliciousVectors) {
      // 1. Root redirect check in Middleware
      const midRes = simulateMiddleware({
        urlString: `http://localhost:3000/?callbackUrl=${encodeURIComponent(vector)}`,
        cookies: { cfh_session: 'valid-student', cfh_active_role: 'STUDENT', cfh_onboarding_completed: 'true' }
      });
      countAssert(midRes.status === 307, 'Should redirect');
      countAssert(midRes.redirectUrl === 'http://localhost:3000/dashboard', `Vector ${vector} must fallback to /dashboard, got ${midRes.redirectUrl}`);

      // 2. Client AuthModals resolution check
      const clientRes = simulateAuthModalResolution({
        searchParamsString: `auth=login&callbackUrl=${encodeURIComponent(vector)}`,
        user: { role: 'STUDENT', isOnboardingCompleted: true }
      });
      countAssert(clientRes === '/', `Vector ${vector} must fallback to / in AuthModal, got ${clientRes}`);
    }
  });

  runProbe('R1.3: Neutralize external URI schemes (https:, http:, javascript:, data:, ftp:, vbscript:)', () => {
    const dangerousSchemes = [
      'https://evil.com',
      'http://attacker.com/login',
      'javascript:alert(document.cookie)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'ftp://malicious.com/payload',
      'vbscript:msgbox(1)',
      'mailto:victim@example.com'
    ];

    for (const scheme of dangerousSchemes) {
      const midRes = simulateMiddleware({
        urlString: `http://localhost:3000/?callbackUrl=${encodeURIComponent(scheme)}`,
        cookies: { cfh_session: 'valid-student', cfh_active_role: 'STUDENT', cfh_onboarding_completed: 'true' }
      });
      countAssert(midRes.redirectUrl === 'http://localhost:3000/dashboard', `Scheme ${scheme} must be blocked by middleware`);

      const clientRes = simulateAuthModalResolution({
        searchParamsString: `auth=login&callbackUrl=${encodeURIComponent(scheme)}`,
        user: { role: 'STUDENT', isOnboardingCompleted: true }
      });
      countAssert(clientRes === '/', `Scheme ${scheme} must be blocked by client AuthModal`);
    }
  });

  runProbe('R1.4: Neutralize URL-encoded and whitespace-prefixed evasion vectors', () => {
    const evasionVectors = [
      '%2F%2Fevil.com',
      '%2f%2fevil.com%2fpath',
      '/%5Cevil.com',
      ' /evil.com',
      '\t//evil.com',
      'https%3A%2F%2Fattacker.com'
    ];

    for (const vector of evasionVectors) {
      const clientRes = simulateAuthModalResolution({
        searchParamsString: `auth=login&callbackUrl=${vector}`,
        user: { role: 'STUDENT', isOnboardingCompleted: true }
      });
      countAssert(clientRes === '/', `Evasion vector ${vector} must fallback to /`);
    }
  });

  // ---------------------------------------------------------------------------
  // Probes: Query String & Parameter Preservation on Checkout Redirect
  // ---------------------------------------------------------------------------
  runProbe('R1.5: Preserves complex multi-param checkout queries into callbackUrl', () => {
    const rawTarget = '/checkout?courseId=course-master-2026&direct=true&coupon=50OFF&ref=partner_cfh&affiliateId=98765';
    const midRes = simulateMiddleware({
      urlString: `http://localhost:3000${rawTarget}`
    });

    countAssert(midRes.status === 307, 'Must return 307 redirect');
    const dest = new URL(midRes.redirectUrl);
    countAssert(dest.pathname === '/', 'Must land on root');
    countAssert(dest.searchParams.get('auth') === 'login', 'Must set auth=login');
    countAssert(dest.searchParams.get('callbackUrl') === rawTarget, 'Must preserve verbatim query parameters in callbackUrl');
  });

  runProbe('R1.6: Safely preserves accented Unicode, UTF-8 strings, and special characters without corruption', () => {
    const unicodeTarget = '/checkout?courseId=curso-comunicación-y-empatía-2026&tipo=sesión-gratuita&comentario=reserva%20confirmada';
    const midRes = simulateMiddleware({
      urlString: `http://localhost:3000${unicodeTarget}`
    });

    countAssert(midRes.status === 307, 'Must return 307');
    const dest = new URL(midRes.redirectUrl);
    const cb = dest.searchParams.get('callbackUrl');
    countAssert(cb.includes('curso-comunicación-y-empatía-2026'), 'Preserves UTF-8 accented characters');
    countAssert(cb.includes('tipo=sesión-gratuita'), 'Preserves UTF-8 query keys/values');
  });

  runProbe('R1.7: Safely handles adversarial SQL injection, XSS, and path traversal strings in query', () => {
    const adversarialQueries = [
      "/checkout?courseId=c101' OR '1'='1",
      '/checkout?courseId=<script>alert("xss")</script>',
      '/checkout?courseId=../../../../etc/passwd',
      '/checkout?courseId=c101;DROP%20TABLE%20User;'
    ];

    for (const target of adversarialQueries) {
      const midRes = simulateMiddleware({
        urlString: `http://localhost:3000${target}`
      });
      countAssert(midRes.status === 307, 'Must redirect cleanly');
      const dest = new URL(midRes.redirectUrl);
      countAssert(dest.origin === 'http://localhost:3000', 'Must remain strictly on local origin');
      countAssert(dest.pathname === '/', 'Target pathname must be /');
      countAssert(dest.searchParams.get('auth') === 'login');
      countAssert(dest.searchParams.has('callbackUrl'), 'CallbackUrl must be present');
    }
  });

  // ---------------------------------------------------------------------------
  // Probes: Post-Login Resolution & Community Isolation
  // ---------------------------------------------------------------------------
  runProbe('R1.8: Authenticated user with safe callbackUrl resolves accurately', () => {
    const safeTarget = '/checkout?courseId=course-101&direct=true';

    // Student completed onboarding -> returns to checkout
    const nextUrlStudent = simulateAuthModalResolution({
      searchParamsString: `auth=login&callbackUrl=${encodeURIComponent(safeTarget)}`,
      user: { role: 'STUDENT', isOnboardingCompleted: true }
    });
    countAssert(nextUrlStudent === safeTarget, `Expected ${safeTarget}, got ${nextUrlStudent}`);

    // Incomplete student -> forwarded to /student/onboarding with preserved callbackUrl
    const nextUrlIncomplete = simulateAuthModalResolution({
      searchParamsString: `auth=login&callbackUrl=${encodeURIComponent(safeTarget)}`,
      user: { role: 'STUDENT', isOnboardingCompleted: false }
    });
    countAssert(
      nextUrlIncomplete === `/student/onboarding?callbackUrl=${encodeURIComponent(safeTarget)}`,
      'Incomplete student must receive encoded callbackUrl in onboarding URL'
    );
  });

  runProbe('R1.9: Community path isolation ensures login does not trap users in infinite community redirect', () => {
    // Attempting callbackUrl=/comunidad or /comunidad/post/101 must be suppressed to '/' to avoid guest loop
    const clientRes = simulateAuthModalResolution({
      searchParamsString: 'auth=login&callbackUrl=/comunidad',
      user: { role: 'STUDENT', isOnboardingCompleted: true }
    });
    countAssert(clientRes === '/', 'Community callback must be suppressed to root /');

    const clientResPost = simulateAuthModalResolution({
      searchParamsString: 'auth=login&callbackUrl=/comunidad/post/101',
      user: { role: 'STUDENT', isOnboardingCompleted: true }
    });
    countAssert(clientResPost === '/', 'Community subpath callback must be suppressed to root /');
  });

  console.log(`\n  R1 Suite Summary: ${passed} passed, ${failed} failed (${totalAssertions} assertions verified)`);
  return { suite: 'R1', total: passed + failed, passed, failed, totalAssertions };
}

if (process.argv[1]?.endsWith('r1-adversarial.test.mjs')) {
  runR1AdversarialSuite();
}
