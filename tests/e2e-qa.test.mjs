/**
 * Coaching From Home — Test Runner Bridge for standard test runners (node --test, Jest, Vitest)
 */

import test from "node:test";
import { strict as assert } from "node:assert";
import { runTier1Tests } from "../scripts/qa-tests/tier1-happy-path.mjs";
import { runTier2Tests } from "../scripts/qa-tests/tier2-business-rules.mjs";
import { runTier3Tests } from "../scripts/qa-tests/tier3-role-access.mjs";
import { runTier4Tests } from "../scripts/qa-tests/tier4-stress-security.mjs";
import { runTier5RefactoringTests } from "../scripts/qa-tests/tier5-refactoring-r1-r5.mjs";
import { runAdversarialConcurrencyTests } from "../scripts/qa-tests/adversarial-concurrency-stress.mjs";
import { buildRequirementsTestSuite } from "./requirements-r1-r5.test.mjs";

test("Tier 1: Core User Flows & Happy Paths", async () => {
  const result = await runTier1Tests();
  assert.strictEqual(result.failed, 0, `Tier 1 had ${result.failed} failures`);
});

test("Tier 2: Boundary & Business Rules", async () => {
  const result = await runTier2Tests();
  assert.strictEqual(result.failed, 0, `Tier 2 had ${result.failed} failures`);
});

test("Tier 3: Role & Access Control", async () => {
  const result = await runTier3Tests();
  assert.strictEqual(result.failed, 0, `Tier 3 had ${result.failed} failures`);
});

test("Tier 4: Acceptance Criteria Stress & Security Tests", async () => {
  const result = await runTier4Tests();
  assert.strictEqual(result.failed, 0, `Tier 4 had ${result.failed} failures`);
});

test("Tier 5: Refactoring R1-R5 Deep Verification", async () => {
  const result = await runTier5RefactoringTests();
  assert.strictEqual(result.failed, 0, `Tier 5 had ${result.failed} failures`);
});

test("Adversarial Concurrency & Double Booking Stress Tests", async () => {
  const result = await runAdversarialConcurrencyTests();
  assert.strictEqual(result.failed, 0, `Adversarial Concurrency had ${result.failed} failures`);
});

test("Requirements R1-R5 (Tiers 1-4): Coach & Apprentice Overhaul Suite", async () => {
  const suite = buildRequirementsTestSuite();
  const result = await suite.run();
  assert.strictEqual(result.failed, 0, `Requirements R1-R5 had ${result.failed} failures`);
});
