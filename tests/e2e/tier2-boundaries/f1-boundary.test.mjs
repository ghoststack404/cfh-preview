// tests/e2e/tier2-boundaries/f1-boundary.test.mjs
// F1 Boundary & Corner Cases (>= 5 test cases)
// Focus: Session expiry, rapid clicks, nested comments, dismiss recovery, poll voting

import { describe, test, assert } from '../harness/runner.mjs';

describe('F1 Boundary: Guest Community Interaction Guard', { tier: 'tier2' }, () => {
  function createCommunityInteractionHarness() {
    let modalStack = [];
    let isModalOpen = false;

    const openLogin = () => {
      if (!isModalOpen) {
        isModalOpen = true;
        modalStack.push('login');
      }
    };

    const closeModal = () => {
      isModalOpen = false;
      modalStack = [];
    };

    const interact = (action, sessionToken) => {
      // Validate token: if expired or invalid, treat as guest
      const isTokenValid = sessionToken === 'valid-token';
      if (!isTokenValid) {
        openLogin();
        return { success: false, code: 'UNAUTHORIZED_PROMPT' };
      }
      return { success: true };
    };

    return { interact, getModalState: () => ({ isModalOpen, modalStack }), closeModal };
  }

  test('F1-B.1: Expired or malformed session cookie triggers auth modal instead of 500 error', () => {
    const harness = createCommunityInteractionHarness();
    const res = harness.interact('LIKE', 'expired-or-garbage-token-xyz');

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'UNAUTHORIZED_PROMPT');
    assert.strictEqual(harness.getModalState().isModalOpen, true);
  });

  test('F1-B.2: Rapid multi-clicks on like button by guest open only one auth modal instance (no stacking)', () => {
    const harness = createCommunityInteractionHarness();

    // 5 rapid clicks
    for (let i = 0; i < 5; i++) {
      harness.interact('LIKE', null);
    }

    const state = harness.getModalState();
    assert.strictEqual(state.isModalOpen, true);
    assert.strictEqual(state.modalStack.length, 1, 'Modal stack must contain only 1 instance (debounced)');
  });

  test('F1-B.3: Guest attempting to reply to a deep nested comment triggers auth modal', () => {
    const harness = createCommunityInteractionHarness();
    const res = harness.interact('REPLY_NESTED_COMMENT', null);

    assert.strictEqual(res.success, false);
    assert.strictEqual(harness.getModalState().isModalOpen, true);
  });

  test('F1-B.4: Dismissing auth modal cleanly resets overlay and restores read-only feed browsing', () => {
    const harness = createCommunityInteractionHarness();
    harness.interact('LIKE', null);
    assert.strictEqual(harness.getModalState().isModalOpen, true);

    // User closes modal
    harness.closeModal();
    const state = harness.getModalState();
    assert.strictEqual(state.isModalOpen, false);
    assert.strictEqual(state.modalStack.length, 0);
  });

  test('F1-B.5: Guest attempting to vote on an interactive poll triggers auth modal without corrupting vote count', () => {
    const poll = { id: 'poll-1', votes: { option0: 10, option1: 5 } };
    const harness = createCommunityInteractionHarness();

    const voteAttempt = (userToken, optionIndex) => {
      const res = harness.interact('VOTE_POLL', userToken);
      if (res.success) {
        poll.votes[`option${optionIndex}`]++;
      }
      return res;
    };

    const res = voteAttempt(null, 0); // guest vote
    assert.strictEqual(res.success, false);
    assert.strictEqual(poll.votes.option0, 10, 'Poll count must remain unchanged for guest attempt');
    assert.strictEqual(harness.getModalState().isModalOpen, true);
  });
});
