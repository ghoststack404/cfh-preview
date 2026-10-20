#!/usr/bin/env node

/**
 * Unified Automated E2E QA Test Runner
 * Coaching From Home — MVP Production Test Suite
 * 
 * Executes Tiers 1 through 5 test suites per TEST_INFRA.md:
 * - Tier 1: Core User Flows & Happy Paths
 * - Tier 2: Boundary & Business Rules (Commissions, Absence, 2nd Chance)
 * - Tier 3: Role & Access Control (Middleware, Feature Gating, Safe Chat)
 * - Tier 4: Acceptance Criteria Stress & Security (Concurrency Double Booking, Signed URLs)
 * - Tier 5: Deep Refactoring Acceptance Criteria (Role Bifurcation, Cart Gating, Theme Sync, Prisma Integrity, AI Moderation)
 * 
 * Usage:
 *   node scripts/qa-tests/run-all.mjs
 *   node scripts/qa-tests/run-all.mjs --tier=1
 *   node scripts/qa-tests/run-all.mjs --tier=5
 *   node scripts/qa-tests/run-all.mjs --json
 */

import { colors } from "./common.mjs";
import { runTier1Tests } from "./tier1-happy-path.mjs";
import { runTier2Tests } from "./tier2-business-rules.mjs";
import { runTier3Tests } from "./tier3-role-access.mjs";
import { runTier4Tests } from "./tier4-stress-security.mjs";
import { runTier5RefactoringTests } from "./tier5-refactoring-r1-r5.mjs";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${colors.bold}Coaching From Home — Automated QA Test Suite Runner${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node scripts/qa-tests/run-all.mjs [options]

${colors.cyan}Options:${colors.reset}
  --tier=1       Run only Tier 1 (Happy Paths & UX Flow Data)
  --tier=2       Run only Tier 2 (Boundary & Business Rules)
  --tier=3       Run only Tier 3 (Role & Access Control)
  --tier=4       Run only Tier 4 (Acceptance Criteria Stress & Security)
  --tier=5       Run only Tier 5 (Refactoring R1-R5 Deep Verification)
  --json         Output results in JSON format
  --help, -h     Show this help message
`);
    process.exit(0);
  }

  const isJson = args.includes("--json");
  const tierArg = args.find((a) => a.startsWith("--tier="))?.split("=")[1];

  const startTime = Date.now();

  if (!isJson) {
    console.log(`\n${colors.bold}${colors.magenta}================================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}   COACHING FROM HOME — AUTOMATED QA TEST HARNESS (TIERS 1-5)   ${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}================================================================${colors.reset}`);
    console.log(`${colors.gray}Starting test run at ${new Date().toISOString()}...${colors.reset}\n`);
  }

  const suiteResults = [];

  try {
    if (!tierArg || tierArg === "1") {
      suiteResults.push(await runTier1Tests());
    }
    if (!tierArg || tierArg === "2") {
      suiteResults.push(await runTier2Tests());
    }
    if (!tierArg || tierArg === "3") {
      suiteResults.push(await runTier3Tests());
    }
    if (!tierArg || tierArg === "4") {
      suiteResults.push(await runTier4Tests());
    }
    if (!tierArg || tierArg === "5") {
      suiteResults.push(await runTier5RefactoringTests());
    }
  } catch (unexpectedErr) {
    console.error(`\n${colors.red}${colors.bold}Fatal Execution Error in Test Runner:${colors.reset}`, unexpectedErr);
    process.exit(1);
  }

  const totalDuration = Date.now() - startTime;
  const totalPassed = suiteResults.reduce((acc, s) => acc + s.passed, 0);
  const totalFailed = suiteResults.reduce((acc, s) => acc + s.failed, 0);
  const totalTests = suiteResults.reduce((acc, s) => acc + s.total, 0);

  if (isJson) {
    const jsonOutput = {
      timestamp: new Date().toISOString(),
      durationMs: totalDuration,
      summary: {
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        successRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) + "%" : "0%",
      },
      suites: suiteResults,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
    console.log(`${colors.bold}                    FINAL TEST SUMMARY                          ${colors.reset}`);
    console.log(`${colors.bold}----------------------------------------------------------------${colors.reset}`);

    for (const s of suiteResults) {
      const badge = s.failed === 0 ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
      console.log(
        `  [${badge}] ${s.name.padEnd(50)} ${colors.gray}(${s.passed}/${s.total} passed in ${s.durationMs}ms)${colors.reset}`
      );
      if (s.failed > 0) {
        for (const err of s.errors) {
          console.log(`        ${colors.red}↳ ${err.test}: ${err.error.message}${colors.reset}`);
        }
      }
    }

    console.log(`----------------------------------------------------------------`);
    if (totalFailed === 0) {
      console.log(
        `\n${colors.bold}${colors.green}ALL SUITES PASSED! [${totalPassed}/${totalTests} tests passed in ${totalDuration}ms]${colors.reset}\n`
      );
    } else {
      console.log(
        `\n${colors.bold}${colors.red}TEST SUITE FAILED! [${totalFailed} tests failed out of ${totalTests} total]${colors.reset}\n`
      );
    }
  }

  process.exit(totalFailed === 0 ? 0 : 1);
}

main();
