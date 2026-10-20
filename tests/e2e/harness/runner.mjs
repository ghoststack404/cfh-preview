// tests/e2e/harness/runner.mjs
// Lightweight, deterministic, high-performance E2E test runner for Coaching & Learning platform

import assert from 'node:assert';

class TestHarness {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
    this.tierStats = {
      tier1: { total: 0, passed: 0, failed: 0 },
      tier2: { total: 0, passed: 0, failed: 0 },
      tier3: { total: 0, passed: 0, failed: 0 },
      tier4: { total: 0, passed: 0, failed: 0 }
    };
    this.startTime = 0;
  }

  describe(name, optionsOrFn, maybeFn) {
    const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;
    const options = typeof optionsOrFn === 'object' ? optionsOrFn : {};
    const tier = options.tier || 'tier1';

    const suite = {
      name,
      tier,
      tests: [],
      beforeEachHooks: [],
      afterEachHooks: [],
    };

    const previousSuite = this.currentSuite;
    this.currentSuite = suite;
    this.suites.push(suite);

    try {
      fn();
    } finally {
      this.currentSuite = previousSuite;
    }
  }

  beforeEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.beforeEachHooks.push(fn);
    }
  }

  afterEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.afterEachHooks.push(fn);
    }
  }

  test(name, fn) {
    if (!this.currentSuite) {
      throw new Error(`test("${name}") must be declared inside a describe() block`);
    }
    this.currentSuite.tests.push({
      name,
      fn,
      tier: this.currentSuite.tier,
      status: 'pending',
      duration: 0,
      error: null
    });
  }

  async run() {
    this.startTime = Date.now();
    console.log('\n' + '='.repeat(80));
    console.log('   COACHING & LEARNING PLATFORM - E2E TEST SUITE RUNNER');
    console.log('   Tiers 1-4: Feature Coverage, Boundaries, Pairwise, Real-World Scenarios');
    console.log('='.repeat(80) + '\n');

    for (const suite of this.suites) {
      console.log(`\n📌 [${suite.tier.toUpperCase()}] ${suite.name}`);

      for (const t of suite.tests) {
        this.totalTests++;
        const tierKey = t.tier || 'tier1';
        if (this.tierStats[tierKey]) {
          this.tierStats[tierKey].total++;
        }

        const testStart = Date.now();
        try {
          for (const hook of suite.beforeEachHooks) {
            await hook();
          }

          await t.fn();

          for (const hook of suite.afterEachHooks) {
            await hook();
          }

          t.status = 'passed';
          t.duration = Date.now() - testStart;
          this.passedTests++;
          if (this.tierStats[tierKey]) this.tierStats[tierKey].passed++;
          console.log(`  ✓ ${t.name} (${t.duration}ms)`);
        } catch (err) {
          t.status = 'failed';
          t.duration = Date.now() - testStart;
          t.error = err;
          this.failedTests++;
          if (this.tierStats[tierKey]) this.tierStats[tierKey].failed++;
          console.error(`  ✗ ${t.name} (${t.duration}ms)`);
          console.error(`    Error: ${err.message}`);
          if (err.stack) {
            const stackSnippet = err.stack.split('\n').slice(1, 4).join('\n');
            console.error(`    ${stackSnippet}`);
          }
        }
      }
    }

    const elapsed = Date.now() - this.startTime;
    this.printSummary(elapsed);

    return this.failedTests === 0 ? 0 : 1;
  }

  printSummary(elapsed) {
    console.log('\n' + '='.repeat(80));
    console.log('                        TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Time: ${(elapsed / 1000).toFixed(2)}s\n`);

    console.log('Tier Breakdown:');
    console.log(`  - Tier 1 (Feature Coverage):     ${this.tierStats.tier1.passed}/${this.tierStats.tier1.total} passed`);
    console.log(`  - Tier 2 (Boundary & Corner):    ${this.tierStats.tier2.passed}/${this.tierStats.tier2.total} passed`);
    console.log(`  - Tier 3 (Cross-Feature Pairwise): ${this.tierStats.tier3.passed}/${this.tierStats.tier3.total} passed`);
    console.log(`  - Tier 4 (Real-World Scenarios): ${this.tierStats.tier4.passed}/${this.tierStats.tier4.total} passed`);
    console.log('-'.repeat(80));
    console.log(`Overall: ${this.passedTests} PASSED, ${this.failedTests} FAILED out of ${this.totalTests} tests`);
    console.log('='.repeat(80));

    if (this.failedTests === 0) {
      console.log('🎉 ALL E2E TEST TIERS COMPLETED SUCCESSFULLY (EXIT 0)');
    } else {
      console.log(`❌ ${this.failedTests} TEST(S) FAILED (EXIT 1)`);
    }
  }
}

export const harness = new TestHarness();
export const describe = harness.describe.bind(harness);
export const test = harness.test.bind(harness);
export const beforeEach = harness.beforeEach.bind(harness);
export const afterEach = harness.afterEach.bind(harness);
export { assert };
