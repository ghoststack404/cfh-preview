// tests/e2e/tier5-adversarial/tier5-adversarial-master.mjs
// Master Runner for Tier 5 White-Box Adversarial Hardening Challenger Suite
// Executes adversarial probes across R1, R2, and R3.
//
// Author: teamwork_preview_challenger_m4_1 (Tier 5 White-Box Adversarial Challenger)

import { runR1AdversarialSuite } from './r1-adversarial.test.mjs';
import { runR2AdversarialSuite } from './r2-adversarial.test.mjs';
import { runR3AdversarialSuite } from './r3-adversarial.test.mjs';

export async function runTier5AdversarialMaster() {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('   TIER 5 WHITE-BOX ADVERSARIAL HARDENING CHALLENGE SUITE (M4)');
  console.log('   Milestones: R1 (Auth & Redirect), R2 (Cart & Player), R3 (Chat & Community)');
  console.log('='.repeat(80));

  const suiteResults = [];

  try {
    const r1 = runR1AdversarialSuite();
    suiteResults.push(r1);

    const r2 = runR2AdversarialSuite();
    suiteResults.push(r2);

    const r3 = runR3AdversarialSuite();
    suiteResults.push(r3);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
    const totalProbes = suiteResults.reduce((acc, s) => acc + s.total, 0);
    const totalPassed = suiteResults.reduce((acc, s) => acc + s.passed, 0);
    const totalFailed = suiteResults.reduce((acc, s) => acc + s.failed, 0);
    const totalAssertions = suiteResults.reduce((acc, s) => acc + s.totalAssertions, 0);

    console.log('\n' + '='.repeat(80));
    console.log('                   TIER 5 ADVERSARIAL EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Execution Time: ${elapsed}s\n`);

    console.log('Suite Breakdown:');
    for (const s of suiteResults) {
      console.log(`  - [${s.suite}] ${s.passed}/${s.total} probes passed (${s.totalAssertions} assertions)`);
    }
    console.log('-'.repeat(80));
    console.log(`Overall: ${totalPassed} PASSED, ${totalFailed} FAILED out of ${totalProbes} adversarial probes`);
    console.log(`Total Assertions Verified: ${totalAssertions}`);
    console.log('='.repeat(80));

    if (totalFailed === 0) {
      console.log('🎉 ALL TIER 5 WHITE-BOX ADVERSARIAL CHALLENGES PASSED (VERDICT: APPROVE)');
      return { success: true, totalProbes, totalPassed, totalFailed, totalAssertions, elapsed };
    } else {
      console.log(`❌ ${totalFailed} ADVERSARIAL PROBE(S) FAILED (VERDICT: REQUEST_CHANGES)`);
      return { success: false, totalProbes, totalPassed, totalFailed, totalAssertions, elapsed };
    }
  } catch (error) {
    console.error('\n❌ TIER 5 MASTER RUNNER EXCEPTION:');
    console.error(error);
    return { success: false, error };
  }
}

if (process.argv[1]?.endsWith('tier5-adversarial-master.mjs')) {
  runTier5AdversarialMaster().then((res) => {
    process.exit(res.success ? 0 : 1);
  });
}
