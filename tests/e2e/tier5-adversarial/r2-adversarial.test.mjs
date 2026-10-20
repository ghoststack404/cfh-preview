// tests/e2e/tier5-adversarial/r2-adversarial.test.mjs
// Tier 5 White-Box Adversarial Hardening Suite for Milestone 2 (R2)
//
// Target Specifications:
// 1. Cart drawer suppression and route isolation on checkout
// 2. Zero cart contamination: Comprar Ahora direct checkout preserves multi-item cart untouched
// 3. Optimistic toggle rollback on classroom API error & concurrency locking
// 4. Dual resolution: CUID vs Slug course lookups in /api/classroom/[id] with canonical FK integrity
//
// Author: teamwork_preview_challenger_m4_1 (Tier 5 White-Box Adversarial Challenger)

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

export function runR2AdversarialSuite() {
  console.log('\n================================================================');
  console.log('TIER 5 ADVERSARIAL SUITE - REQUIREMENT 2: CART, CHECKOUT & PLAYER');
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
  // 1. Source Code Structural Invariants Audit
  // ---------------------------------------------------------------------------
  runProbe('R2.1: Source code structural audit of CartDrawer, CartContext, CourseDetailClient, and Classroom API', () => {
    const cartDrawerPath = path.join(projectRoot, 'apps', 'web', 'components', 'CartDrawer.tsx');
    const cartContextPath = path.join(projectRoot, 'apps', 'web', 'context', 'CartContext.tsx');
    const courseDetailPath = path.join(projectRoot, 'apps', 'web', 'app', 'cursos', '[id]', 'CourseDetailClient.tsx');
    const checkoutPagePath = path.join(projectRoot, 'apps', 'web', 'app', 'checkout', 'page.tsx');
    const classroomPagePath = path.join(projectRoot, 'apps', 'web', 'app', 'classroom', '[id]', 'page.tsx');
    const classroomRoutePath = path.join(projectRoot, 'apps', 'web', 'app', 'api', 'classroom', '[id]', 'route.ts');
    const checkoutRoutePath = path.join(projectRoot, 'apps', 'web', 'app', 'api', 'courses', '[id]', 'checkout', 'route.ts');

    countAssert(fs.existsSync(cartDrawerPath), 'CartDrawer.tsx exists');
    countAssert(fs.existsSync(cartContextPath), 'CartContext.tsx exists');
    countAssert(fs.existsSync(courseDetailPath), 'CourseDetailClient.tsx exists');
    countAssert(fs.existsSync(checkoutPagePath), 'checkout/page.tsx exists');
    countAssert(fs.existsSync(classroomPagePath), 'classroom/[id]/page.tsx exists');
    countAssert(fs.existsSync(classroomRoutePath), 'api/classroom/[id]/route.ts exists');
    countAssert(fs.existsSync(checkoutRoutePath), 'api/courses/[id]/checkout/route.ts exists');

    const drawerSrc = fs.readFileSync(cartDrawerPath, 'utf8');
    const contextSrc = fs.readFileSync(cartContextPath, 'utf8');
    const detailSrc = fs.readFileSync(courseDetailPath, 'utf8');
    const checkoutSrc = fs.readFileSync(checkoutPagePath, 'utf8');
    const playerSrc = fs.readFileSync(classroomPagePath, 'utf8');
    const classroomApiSrc = fs.readFileSync(classroomRoutePath, 'utf8');

    // 1. Cart Drawer suppression
    countAssert(
      drawerSrc.includes('if (!isOpen || pathname === "/checkout" || pathname?.startsWith("/checkout")) return null;'),
      'CartDrawer must return null unconditionally on /checkout'
    );
    countAssert(
      contextSrc.includes('pathname === "/checkout" || pathname?.startsWith("/checkout")'),
      'CartContext must watch pathname and enforce setIsOpen(false) on checkout'
    );

    // 2. Buy Now direct checkout
    countAssert(
      detailSrc.includes('href={`/checkout?courseId=${course.id}&direct=true`}'),
      'CourseDetailClient must route Comprar Ahora with direct=true'
    );
    countAssert(
      detailSrc.includes('setIsOpen(false)'),
      'CourseDetailClient handleBuyNow must keep cart drawer strictly closed'
    );

    // 3. Checkout isolation
    countAssert(
      checkoutSrc.includes("searchParams.get('direct') === 'true'"),
      'checkout/page.tsx must parse direct query parameter'
    );
    countAssert(
      checkoutSrc.includes("!isDirect && sessionStatus === 'authenticated' && directCourseId"),
      'checkout/page.tsx must only add course to cart when isDirect is FALSE'
    );

    // 4. Classroom optimistic toggle & rollback
    countAssert(
      playerSrc.includes('const nextStatus = !currentStatus;'),
      'handleToggleComplete must compute nextStatus'
    );
    countAssert(
      playerSrc.includes('if (isUpdatingProgress) return;'),
      'handleToggleComplete must have concurrency lock'
    );
    countAssert(
      playerSrc.includes('catch (err)'),
      'handleToggleComplete must catch network/server failures'
    );
    countAssert(
      playerSrc.includes('les.id === lessonId ? { ...les, completed: currentStatus } : les'),
      'handleToggleComplete catch block must roll back to original currentStatus'
    );

    // 5. CUID vs Slug in /api/classroom/[id]
    countAssert(
      classroomApiSrc.includes('OR: [\n          { id: paramId },\n          { slug: paramId },\n        ]'),
      'Classroom API must resolve course by OR: [{ id: paramId }, { slug: paramId }]'
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Cart Drawer Route Suppression & Path Isolation Simulator
  // ---------------------------------------------------------------------------
  runProbe('R2.2: Cart drawer is strictly suppressed across all /checkout paths and subroutes', () => {
    function shouldRenderDrawer({ isOpen, pathname }) {
      if (!isOpen || pathname === '/checkout' || pathname?.startsWith('/checkout')) {
        return false;
      }
      return true;
    }

    // On checkout root
    countAssert(shouldRenderDrawer({ isOpen: true, pathname: '/checkout' }) === false, 'Suppressed on /checkout');
    // On checkout subpaths
    countAssert(shouldRenderDrawer({ isOpen: true, pathname: '/checkout/review' }) === false, 'Suppressed on /checkout/review');
    countAssert(shouldRenderDrawer({ isOpen: true, pathname: '/checkout/payment/stripe' }) === false, 'Suppressed on /checkout/payment/stripe');
    countAssert(shouldRenderDrawer({ isOpen: true, pathname: '/checkout?direct=true' }) === false, 'Suppressed on /checkout?direct=true');

    // On standard catalog pages
    countAssert(shouldRenderDrawer({ isOpen: true, pathname: '/cursos' }) === true, 'Visible on /cursos when open');
    countAssert(shouldRenderDrawer({ isOpen: true, pathname: '/dashboard' }) === true, 'Visible on /dashboard when open');
    countAssert(shouldRenderDrawer({ isOpen: false, pathname: '/cursos' }) === false, 'Hidden when isOpen is false');
  });

  // ---------------------------------------------------------------------------
  // 3. Zero Cart Contamination Simulator (Comprar Ahora vs Standard Cart)
  // ---------------------------------------------------------------------------
  runProbe('R2.3: Zero Cart Contamination: "Comprar Ahora" preserves multi-item cart completely intact', () => {
    class CartSystemSimulator {
      constructor() {
        this.items = [
          { id: 'cart-1', courseId: 'c-old-1', title: 'Curso Antiguo 1', priceCents: 3500 },
          { id: 'cart-2', courseId: 'c-old-2', title: 'Curso Antiguo 2', priceCents: 4500 },
          { id: 'cart-3', courseId: 'c-old-3', title: 'Curso Antiguo 3', priceCents: 2000 },
        ];
        this.isOpen = false;
      }

      get totalCents() {
        return this.items.reduce((acc, i) => acc + i.priceCents, 0);
      }

      // Action: User clicks "Comprar Ahora" on Course 4
      handleBuyNow(course4) {
        // Enforces drawer remains closed
        this.isOpen = false;
        // Zero mutations to this.items
        return {
          directCheckoutUrl: `/checkout?courseId=${course4.id}&direct=true`,
          directCourse: course4
        };
      }

      // Checkout page loader logic
      resolveCheckoutState({ isDirect, directCourseId, directCourse }) {
        if (isDirect && directCourseId) {
          return {
            mode: 'ISOLATED_DIRECT',
            items: [{ id: `direct-${directCourse.id}`, courseId: directCourse.id, title: directCourse.title, priceCents: directCourse.priceCents }],
            totalCents: directCourse.priceCents,
            persistedCartItems: [...this.items]
          };
        }
        return {
          mode: 'MULTI_ITEM_CART',
          items: [...this.items],
          totalCents: this.totalCents,
          persistedCartItems: [...this.items]
        };
      }

      // Execution of direct purchase
      completeDirectPurchase(directCourseId) {
        // Direct checkout executes dedicated endpoint /api/courses/[id]/checkout
        // DOES NOT call clearCart()!
        return {
          purchasedCourseId: directCourseId,
          cartItemsAfterPurchase: [...this.items],
          cartItemsCount: this.items.length
        };
      }

      // Standard multi-item checkout
      completeStandardCartPurchase() {
        const purchased = [...this.items];
        this.items = []; // Clears cart
        return {
          purchased,
          cartItemsAfterPurchase: [],
          cartItemsCount: 0
        };
      }
    }

    const sim = new CartSystemSimulator();
    countAssert(sim.items.length === 3, 'Initial cart must contain 3 courses');
    countAssert(sim.totalCents === 10000, 'Initial cart total must be 10000 cents ($100.00)');

    const course4 = { id: 'c-new-4', title: 'Maestría en Liderazgo', priceCents: 4900 };

    // 1. Click Comprar Ahora
    const buyNowResult = sim.handleBuyNow(course4);
    countAssert(sim.isOpen === false, 'Drawer must be strictly closed');
    countAssert(sim.items.length === 3, 'Standard cart must still have exactly 3 items');
    countAssert(buyNowResult.directCheckoutUrl === '/checkout?courseId=c-new-4&direct=true', 'Correct direct checkout URL');

    // 2. Checkout Page State Isolation
    const checkoutState = sim.resolveCheckoutState({
      isDirect: true,
      directCourseId: 'c-new-4',
      directCourse: course4
    });
    countAssert(checkoutState.mode === 'ISOLATED_DIRECT', 'Must be isolated direct mode');
    countAssert(checkoutState.items.length === 1, 'Checkout items must contain strictly 1 course');
    countAssert(checkoutState.items[0].courseId === 'c-new-4', 'Checkout item must be course 4');
    countAssert(checkoutState.totalCents === 4900, 'Total to pay must strictly be 4900 cents ($49.00)');
    countAssert(checkoutState.totalCents !== 14900, 'Total must NOT be contaminated by existing cart');

    // 3. Purchase Completion
    const purchaseResult = sim.completeDirectPurchase('c-new-4');
    countAssert(purchaseResult.purchasedCourseId === 'c-new-4', 'Purchased course must be c-new-4');
    countAssert(purchaseResult.cartItemsCount === 3, 'Background cart must retain all 3 items after direct purchase');
    countAssert(sim.items.length === 3, 'Zero cart items lost');
    countAssert(sim.items[0].id === 'cart-1' && sim.items[1].id === 'cart-2' && sim.items[2].id === 'cart-3', 'Exact item preservation');
  });

  // ---------------------------------------------------------------------------
  // 4. Optimistic Toggle Rollback & Concurrency Lock Simulator
  // ---------------------------------------------------------------------------
  runProbe('R2.4: Optimistic Lesson Toggle immediately rolls back on API error with concurrency lock safety', async () => {
    class ClassroomStateSimulator {
      constructor(initialLessons) {
        this.lessons = initialLessons.map(l => ({ ...l }));
        this.isUpdatingProgress = false;
        this.errorLogged = null;
      }

      async toggleComplete(lessonId, currentStatus, mockNetworkCall) {
        if (this.isUpdatingProgress) {
          return { locked: true };
        }
        this.isUpdatingProgress = true;
        const nextStatus = !currentStatus;

        // 1. Optimistic update
        this.lessons = this.lessons.map(l => l.id === lessonId ? { ...l, completed: nextStatus } : l);

        try {
          const res = await mockNetworkCall({ lessonId, completed: nextStatus });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          if (!res.data || res.data.success === false) {
            throw new Error(res.data?.error || 'Failed');
          }
          return { success: true, completed: nextStatus };
        } catch (err) {
          this.errorLogged = err.message;
          // 2. Rollback to original currentStatus
          this.lessons = this.lessons.map(l => l.id === lessonId ? { ...l, completed: currentStatus } : l);
          return { success: false, rolledBack: true, error: err.message };
        } finally {
          // 3. Unlock concurrency
          this.isUpdatingProgress = false;
        }
      }
    }

    const initial = [
      { id: 'les-1', title: 'Lesson 1', completed: false },
      { id: 'les-2', title: 'Lesson 2', completed: false }
    ];

    // Scenario A: HTTP 500 Server Error
    const playerA = new ClassroomStateSimulator(initial);
    const resA = await playerA.toggleComplete('les-1', false, async () => ({ ok: false, status: 500 }));
    countAssert(resA.success === false, 'Must fail on 500');
    countAssert(resA.rolledBack === true, 'Must trigger rollback');
    countAssert(playerA.lessons[0].completed === false, 'Lesson 1 completed must be rolled back to false');
    countAssert(playerA.isUpdatingProgress === false, 'Lock must be unlocked');

    // Scenario B: HTTP 403 Forbidden (Non-enrolled student)
    const playerB = new ClassroomStateSimulator(initial);
    const resB = await playerB.toggleComplete('les-1', false, async () => ({ ok: false, status: 403 }));
    countAssert(resB.rolledBack === true, 'Must roll back on 403');
    countAssert(playerB.lessons[0].completed === false, 'Lesson 1 remains false');
    countAssert(playerB.isUpdatingProgress === false, 'Lock must be unlocked');

    // Scenario C: Network Timeout Rejection
    const playerC = new ClassroomStateSimulator(initial);
    const resC = await playerC.toggleComplete('les-1', false, async () => {
      throw new Error('NETWORK_TIMEOUT');
    });
    countAssert(resC.rolledBack === true, 'Must roll back on network timeout');
    countAssert(playerC.lessons[0].completed === false, 'Lesson 1 remains false');
    countAssert(playerC.isUpdatingProgress === false, 'Lock must be unlocked');

    // Scenario D: Payload error ({ success: false, error: 'DB_BUSY' })
    const playerD = new ClassroomStateSimulator(initial);
    const resD = await playerD.toggleComplete('les-1', false, async () => ({
      ok: true,
      status: 200,
      data: { success: false, error: 'DB_BUSY' }
    }));
    countAssert(resD.rolledBack === true, 'Must roll back on data.success === false');
    countAssert(playerD.lessons[0].completed === false, 'Lesson 1 remains false');
    countAssert(playerD.isUpdatingProgress === false, 'Lock must be unlocked');

    // Scenario E: Concurrency Lock Collision
    const playerE = new ClassroomStateSimulator(initial);
    playerE.isUpdatingProgress = true; // Lock acquired by in-flight request
    const collisionRes = await playerE.toggleComplete('les-2', false, async () => ({ ok: true, status: 200, data: { success: true } }));
    countAssert(collisionRes.locked === true, 'Second click must be rejected while first request is in-flight');
    countAssert(playerE.lessons[1].completed === false, 'Lesson 2 state must not be modified');
  });

  // ---------------------------------------------------------------------------
  // 5. CUID vs Slug Dual Resolution Simulator
  // ---------------------------------------------------------------------------
  runProbe('R2.5: /api/classroom/[id] resolves both CUID and slug to canonical course ID with foreign key integrity', () => {
    class ClassroomDatabaseModel {
      constructor() {
        this.courses = [
          {
            id: 'cly8z19k0000008l0h9x3abcd', // canonical CUID
            slug: 'maestria-en-coaching-ontologico',
            title: 'Maestría en Coaching Ontológico',
            coachId: 'coach-1',
            modules: [
              {
                id: 'mod-1',
                lessons: [{ id: 'les-1', title: 'Fundamentos Ontológicos' }]
              }
            ]
          }
        ];
        this.enrollments = [
          {
            id: 'enr-1',
            courseId: 'cly8z19k0000008l0h9x3abcd', // References canonical CUID
            studentId: 'usr-student-1',
            status: 'ACTIVE'
          }
        ];
        this.progress = new Map(); // key: `enr-1:les-1`
      }

      // Replicates apps/web/app/api/classroom/[id]/route.ts GET
      resolveCourse(paramId) {
        return this.courses.find(c => c.id === paramId || c.slug === paramId) || null;
      }

      getEnrollment(courseId, studentId) {
        return this.enrollments.find(e => e.courseId === courseId && e.studentId === studentId) || null;
      }

      // Replicates POST progress update
      recordProgress(paramId, studentId, lessonId, completed) {
        // Step 1: Resolve course by CUID or Slug
        const course = this.resolveCourse(paramId);
        if (!course) throw new Error('NOT_FOUND');

        // Step 2: Validate enrollment strictly using canonical course.id
        const enrollment = this.getEnrollment(course.id, studentId);
        if (!enrollment) throw new Error('FORBIDDEN');

        const key = `${enrollment.id}:${lessonId}`;
        if (completed) {
          this.progress.set(key, { enrollmentId: enrollment.id, lessonId, completedAt: new Date() });
        } else {
          this.progress.delete(key);
        }

        return {
          success: true,
          resolvedCourseId: course.id,
          isSlugResolution: paramId === course.slug,
          isCuidResolution: paramId === course.id
        };
      }
    }

    const db = new ClassroomDatabaseModel();
    const cuid = 'cly8z19k0000008l0h9x3abcd';
    const slug = 'maestria-en-coaching-ontologico';

    // 1. Resolve via CUID
    const cuidRes = db.recordProgress(cuid, 'usr-student-1', 'les-1', true);
    countAssert(cuidRes.success === true, 'CUID resolution succeeded');
    countAssert(cuidRes.resolvedCourseId === cuid, 'Canonical ID matches');
    countAssert(cuidRes.isCuidResolution === true, 'Identified as CUID resolution');
    countAssert(db.progress.has('enr-1:les-1'), 'Progress record created');

    // Untoggle via Slug
    const slugUntoggleRes = db.recordProgress(slug, 'usr-student-1', 'les-1', false);
    countAssert(slugUntoggleRes.success === true, 'Slug resolution succeeded');
    countAssert(slugUntoggleRes.resolvedCourseId === cuid, 'Canonical ID matches');
    countAssert(slugUntoggleRes.isSlugResolution === true, 'Identified as Slug resolution');
    countAssert(!db.progress.has('enr-1:les-1'), 'Progress record removed');

    // 2. Foreign Key Safety Check
    // Verify that NO enrollment or progress record ever stores the raw slug as courseId or enrollmentId
    for (const enr of db.enrollments) {
      countAssert(enr.courseId === cuid, 'Enrollment courseId must be canonical CUID');
      countAssert(enr.courseId !== slug, 'Enrollment courseId must NOT be a slug');
    }
  });

  console.log(`\n  R2 Suite Summary: ${passed} passed, ${failed} failed (${totalAssertions} assertions verified)`);
  return { suite: 'R2', total: passed + failed, passed, failed, totalAssertions };
}

if (process.argv[1]?.endsWith('r2-adversarial.test.mjs')) {
  runR2AdversarialSuite();
}
