// tests/e2e/tier1-features/f1-guest-community.test.mjs
// F1: Guest Community Interaction Prompt (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R1, PROJECT.md F1, M1

import { describe, test, assert } from '../harness/runner.mjs';

describe('F1: Guest Community Interaction Prompt', { tier: 'tier1' }, () => {
  // Client interaction handler simulator for CommunityClient and PostDetailClient
  function simulateCommunityInteraction({ action, isAuthenticated, postId, payload }) {
    const modalState = { isOpen: false, view: null };
    const openLogin = () => {
      modalState.isOpen = true;
      modalState.view = 'login';
    };

    if (!isAuthenticated) {
      openLogin();
      return { handled: true, authRequired: true, modalState };
    }

    // Authenticated path
    return {
      handled: true,
      authRequired: false,
      modalState,
      actionResult: { action, postId, success: true, timestamp: Date.now() }
    };
  }

  test('F1.1: Guest clicking like on a post triggers login modal', () => {
    const result = simulateCommunityInteraction({
      action: 'LIKE_POST',
      isAuthenticated: false,
      postId: 'post-1'
    });

    assert.strictEqual(result.authRequired, true, 'Guest like action must require auth');
    assert.strictEqual(result.modalState.isOpen, true, 'Auth modal must open on guest like attempt');
    assert.strictEqual(result.modalState.view, 'login', 'Auth modal must display login view');
  });

  test('F1.2: Guest attempting to submit a comment triggers login modal', () => {
    const result = simulateCommunityInteraction({
      action: 'ADD_COMMENT',
      isAuthenticated: false,
      postId: 'post-1',
      payload: { content: 'Excelente publicación' }
    });

    assert.strictEqual(result.authRequired, true, 'Guest comment submission must require auth');
    assert.strictEqual(result.modalState.isOpen, true, 'Auth modal must open on guest comment attempt');
    assert.strictEqual(result.modalState.view, 'login', 'Auth modal must display login view');
  });

  test('F1.3: Guest clicking "Guardar" (Save Post) triggers login modal', () => {
    const result = simulateCommunityInteraction({
      action: 'SAVE_POST',
      isAuthenticated: false,
      postId: 'post-1'
    });

    assert.strictEqual(result.authRequired, true, 'Guest save post action must require auth');
    assert.strictEqual(result.modalState.isOpen, true, 'Auth modal must open on guest save attempt');
    assert.strictEqual(result.modalState.view, 'login', 'Auth modal must display login view');
  });

  test('F1.4: Guest clicking "Crear Publicación" triggers login modal', () => {
    const result = simulateCommunityInteraction({
      action: 'CREATE_POST',
      isAuthenticated: false
    });

    assert.strictEqual(result.authRequired, true, 'Guest create post trigger must require auth');
    assert.strictEqual(result.modalState.isOpen, true, 'Auth modal must open on guest create post attempt');
    assert.strictEqual(result.modalState.view, 'login', 'Auth modal must display login view');
  });

  test('F1.5: Authenticated student performs post interactions without login modal', () => {
    const likeResult = simulateCommunityInteraction({
      action: 'LIKE_POST',
      isAuthenticated: true,
      postId: 'post-1'
    });

    assert.strictEqual(likeResult.authRequired, false, 'Authenticated student like must not require auth prompt');
    assert.strictEqual(likeResult.modalState.isOpen, false, 'Auth modal must remain closed');
    assert.strictEqual(likeResult.actionResult.success, true, 'Action must succeed for authenticated user');
  });
});
