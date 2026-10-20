// tests/e2e/run-all.mjs
// Master E2E Test Suite Runner for Coaching & Learning Platform
// Covers Tiers 1-4: Feature Coverage, Boundaries, Pairwise, Real-World Scenarios

import { harness } from './harness/runner.mjs';

// Tier 1: Feature Coverage (>=5 test cases per feature for F1-F10)
import './tier1-features/f1-guest-community.test.mjs';
import './tier1-features/f1-adversarial-challenger.test.mjs';
import './tier1-features/f2-guest-checkout.test.mjs';
import './tier1-features/f3-role-routing.test.mjs';
import './tier1-features/f4-dashboard-ui.test.mjs';
import './tier1-features/f5-free-booking.test.mjs';
import './tier1-features/f6-cart-buynow.test.mjs';
import './tier1-features/f7-course-player.test.mjs';
import './tier1-features/f8-realtime-chat.test.mjs';
import './tier1-features/f9-presence.test.mjs';
import './tier1-features/f10-feed-savedpost.test.mjs';
import './tier1-features/f10-adversarial-challenger.test.mjs';

// Tier 2: Boundary & Corner Cases (>=5 test cases per feature for F1-F10)
import './tier2-boundaries/f1-boundary.test.mjs';
import './tier2-boundaries/f2-boundary.test.mjs';
import './tier2-boundaries/f3-boundary.test.mjs';
import './tier2-boundaries/f4-boundary.test.mjs';
import './tier2-boundaries/f5-boundary.test.mjs';
import './tier2-boundaries/f6-boundary.test.mjs';
import './tier2-boundaries/f7-boundary.test.mjs';
import './tier2-boundaries/f8-boundary.test.mjs';
import './tier2-boundaries/f9-boundary.test.mjs';
import './tier2-boundaries/f10-boundary.test.mjs';

// Tier 3: Cross-Feature Pairwise Interactions (12 test cases)
import './tier3-pairwise/pairwise-combinations.test.mjs';

// Tier 4: Real-World Workload Scenarios (5 comprehensive end-to-end user journeys)
import './tier4-scenarios/scenario1-guest-conversion.test.mjs';
import './tier4-scenarios/scenario2-coaching-intake.test.mjs';
import './tier4-scenarios/scenario3-community-collaboration.test.mjs';
import './tier4-scenarios/scenario4-course-purchase-player.test.mjs';
import './tier4-scenarios/scenario5-live-chat-messaging.test.mjs';

const exitCode = await harness.run();
process.exit(exitCode);
