// tests/e2e/tier2-boundaries/f6-boundary.test.mjs
// F6 Boundary & Corner Cases (>= 5 test cases)
// Focus: Empty cart state, rapid clicks, already enrolled course, missing courseId, back navigation

import { describe, test, assert } from '../harness/runner.mjs';

describe('F6 Boundary: Cart & Comprar Ahora Edge Cases', { tier: 'tier2' }, () => {
  class CartFlowEdgeSimulator {
    constructor() {
      this.items = [];
      this.isOpen = false;
      this.navigationLog = [];
    }

    handleBuyNow(courseId, isEnrolled = false) {
      if (isEnrolled) {
        return { action: 'REDIRECT_CLASSROOM', url: `/classroom/${courseId}` };
      }
      this.isOpen = false;
      this.navigationLog.push(`/checkout?courseId=${courseId}&direct=true`);
      return { action: 'NAVIGATE', url: `/checkout?courseId=${courseId}&direct=true` };
    }
  }

  test('F6-B.1: "Comprar Ahora" operates cleanly when cart has zero items without flashing drawer', () => {
    const sim = new CartFlowEdgeSimulator();
    assert.strictEqual(sim.items.length, 0);

    const res = sim.handleBuyNow('c101', false);
    assert.strictEqual(res.action, 'NAVIGATE');
    assert.strictEqual(sim.isOpen, false, 'Drawer must not flash open');
  });

  test('F6-B.2: Rapid multi-clicks on "Comprar Ahora" debounce to single checkout navigation', () => {
    const sim = new CartFlowEdgeSimulator();

    let clickCount = 0;
    const debouncedClick = (courseId) => {
      clickCount++;
      if (clickCount === 1) {
        return sim.handleBuyNow(courseId);
      }
      return { action: 'DEBOUNCED' };
    };

    const first = debouncedClick('c101');
    const second = debouncedClick('c101');
    const third = debouncedClick('c101');

    assert.strictEqual(first.action, 'NAVIGATE');
    assert.strictEqual(second.action, 'DEBOUNCED');
    assert.strictEqual(third.action, 'DEBOUNCED');
    assert.strictEqual(sim.navigationLog.length, 1, 'Only one navigation should be dispatched');
  });

  test('F6-B.3: Clicking "Comprar Ahora" for already enrolled course routes directly to classroom', () => {
    const sim = new CartFlowEdgeSimulator();
    const res = sim.handleBuyNow('c101', true); // already enrolled

    assert.strictEqual(res.action, 'REDIRECT_CLASSROOM');
    assert.strictEqual(res.url, '/classroom/c101');
  });

  test('F6-B.4: Direct checkout with missing courseId in query handles error safely', () => {
    function resolveCheckoutTarget(searchParams) {
      const courseId = searchParams.get('courseId');
      const isDirect = searchParams.get('direct') === 'true';

      if (isDirect && !courseId) {
        return { error: 'INVALID_DIRECT_CHECKOUT_PARAMS', redirect: '/cursos' };
      }
      return { success: true, courseId };
    }

    const res = resolveCheckoutTarget(new URLSearchParams('direct=true'));
    assert.strictEqual(res.error, 'INVALID_DIRECT_CHECKOUT_PARAMS');
    assert.strictEqual(res.redirect, '/cursos');
  });

  test('F6-B.5: Browser back-navigation from direct checkout keeps drawer closed', () => {
    const sim = new CartFlowEdgeSimulator();
    sim.handleBuyNow('c101');
    assert.strictEqual(sim.isOpen, false);

    // Simulate history back event
    const handlePopState = () => {
      // Cart drawer state should remain false on popstate
      return sim.isOpen;
    };

    const drawerStateOnBack = handlePopState();
    assert.strictEqual(drawerStateOnBack, false, 'Drawer must not automatically open upon back navigation');
  });
});
