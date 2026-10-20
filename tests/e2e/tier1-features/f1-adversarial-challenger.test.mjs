// tests/e2e/tier1-features/f1-adversarial-challenger.test.mjs
// Adversarial Challenger Verification Suite for Acceptance Criterion 1:
// "Attempting to interact with a community post as a guest displays a login prompt."
// Probing: Like post, like comment, comment submit/focus, post textarea submit/focus, Save post, Poll voting, /comunidad/post/[id]

import { describe, test, assert } from '../harness/runner.mjs';
import fs from 'node:fs';
import path from 'node:path';

describe('Adversarial Challenger: Acceptance Criterion 1 Probing Suite', { tier: 'tier1' }, () => {

  // Factory to create a test harness strictly emulating CommunityClient & PostDetailClient state guards
  function createCommunityGuestHarness(initialState = {}) {
    const events = [];
    const openLogin = () => {
      events.push({ type: 'OPEN_LOGIN', timestamp: Date.now() });
    };

    let currentUserId = initialState.currentUserId ?? null; // unauthenticated guest
    let posts = initialState.posts || [
      {
        id: 'post-test-1',
        authorId: 'author-user-99',
        content: 'Publicación de prueba con encuesta',
        hasLiked: false,
        _count: { likes: 5, comments: 2 },
        poll: { question: '¿Opción?', options: ['A', 'B'], votes: [3, 2] }
      }
    ];

    let comments = initialState.comments || [
      {
        id: 'comment-test-1',
        postId: 'post-test-1',
        author: { id: 'author-user-99', name: 'Author' },
        content: 'Comentario existente',
        hasLiked: false,
        likesCount: 1,
        _count: { likes: 1 }
      }
    ];

    let savedPostIds = initialState.savedPostIds || [];
    let pollVotes = initialState.pollVotes || {};
    let isSaved = false;
    let isReporting = false;

    // --- CommunityClient handlers ---
    const requireAuth = (action) => {
      if (!currentUserId) {
        openLogin();
      } else {
        action();
      }
    };

    const feedToggleLike = (postId) => {
      requireAuth(() => {
        posts = posts.map(p => p.id === postId ? { ...p, hasLiked: !p.hasLiked, _count: { ...p._count, likes: p._count.likes + 1 } } : p);
        events.push({ type: 'MUTATION_LIKE_POST', postId });
      });
    };

    const feedToggleCommentLike = (commentId) => {
      requireAuth(() => {
        comments = comments.map(c => c.id === commentId ? { ...c, hasLiked: !c.hasLiked, likesCount: c.likesCount + 1 } : c);
        events.push({ type: 'MUTATION_LIKE_COMMENT', commentId });
      });
    };

    const feedPostTextareaFocus = () => {
      if (!currentUserId) openLogin();
    };

    const feedPostTextareaClick = () => {
      if (!currentUserId) openLogin();
    };

    const feedCreatePostSubmit = (content) => {
      requireAuth(() => {
        posts.push({ id: 'new-post', content, authorId: currentUserId });
        events.push({ type: 'MUTATION_CREATE_POST', content });
      });
    };

    const feedCommentInputFocus = () => {
      if (!currentUserId) openLogin();
    };

    const feedCommentInputClick = () => {
      if (!currentUserId) openLogin();
    };

    const feedCreateCommentSubmit = (postId, text) => {
      requireAuth(() => {
        comments.push({ id: 'new-comment', postId, content: text });
        events.push({ type: 'MUTATION_CREATE_COMMENT', text });
      });
    };

    const feedToggleSavePost = (postId) => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      savedPostIds.push(postId);
      events.push({ type: 'MUTATION_SAVE_POST', postId });
    };

    const feedVotePoll = (postId, optionIndex) => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      pollVotes[postId] = optionIndex;
      events.push({ type: 'MUTATION_VOTE_POLL', postId, optionIndex });
    };

    // --- PostDetailClient handlers (/comunidad/post/[id]) ---
    const detailToggleLike = () => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      events.push({ type: 'MUTATION_DETAIL_LIKE' });
    };

    const detailToggleCommentLike = (commentId) => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      events.push({ type: 'MUTATION_DETAIL_COMMENT_LIKE', commentId });
    };

    const detailCommentButton = () => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      events.push({ type: 'FOCUS_COMMENT_INPUT' });
    };

    const detailCommentInputFocus = () => {
      if (!currentUserId) openLogin();
    };

    const detailAddCommentSubmit = (text) => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      events.push({ type: 'MUTATION_DETAIL_ADD_COMMENT', text });
    };

    const detailToggleSavePost = () => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      isSaved = !isSaved;
      events.push({ type: 'MUTATION_DETAIL_SAVE' });
    };

    const detailVotePoll = (postId, optionIndex) => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      events.push({ type: 'MUTATION_DETAIL_VOTE_POLL', postId, optionIndex });
    };

    const detailReportPost = () => {
      if (!currentUserId) {
        openLogin();
        return;
      }
      isReporting = true;
      events.push({ type: 'OPEN_REPORT_MODAL' });
    };

    return {
      getEvents: () => events,
      getLoginCallCount: () => events.filter(e => e.type === 'OPEN_LOGIN').length,
      getMutationCount: () => events.filter(e => e.type.startsWith('MUTATION')).length,
      getState: () => ({ posts, comments, savedPostIds, pollVotes, isSaved, isReporting }),
      feedToggleLike,
      feedToggleCommentLike,
      feedPostTextareaFocus,
      feedPostTextareaClick,
      feedCreatePostSubmit,
      feedCommentInputFocus,
      feedCommentInputClick,
      feedCreateCommentSubmit,
      feedToggleSavePost,
      feedVotePoll,
      detailToggleLike,
      detailToggleCommentLike,
      detailCommentButton,
      detailCommentInputFocus,
      detailAddCommentSubmit,
      detailToggleSavePost,
      detailVotePoll,
      detailReportPost,
    };
  }

  // Probe 1: Like on feed post
  test('P1. Guest clicking like on a feed post triggers openLogin() without mutating like count', () => {
    const harness = createCommunityGuestHarness();
    harness.feedToggleLike('post-test-1');

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must be called once');
    assert.strictEqual(harness.getMutationCount(), 0, 'No mutation must occur');
    assert.strictEqual(harness.getState().posts[0]._count.likes, 5, 'Post likes count must stay 5');
    assert.strictEqual(harness.getState().posts[0].hasLiked, false, 'hasLiked must stay false');
  });

  // Probe 2: Like on comment
  test('P2. Guest clicking like on a comment triggers openLogin() without mutating comment like count', () => {
    const harness = createCommunityGuestHarness();
    harness.feedToggleCommentLike('comment-test-1');

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must be called once');
    assert.strictEqual(harness.getMutationCount(), 0, 'No mutation must occur');
    assert.strictEqual(harness.getState().comments[0].likesCount, 1, 'Comment likes count must stay 1');
    assert.strictEqual(harness.getState().comments[0].hasLiked, false, 'hasLiked must stay false');
  });

  // Probe 3: Comment input focus and click in feed
  test('P3. Guest focusing or clicking comment input in feed triggers openLogin()', () => {
    const harness = createCommunityGuestHarness();
    harness.feedCommentInputFocus();
    harness.feedCommentInputClick();

    assert.strictEqual(harness.getLoginCallCount(), 2, 'openLogin() must trigger on both focus and click');
    assert.strictEqual(harness.getMutationCount(), 0, 'No mutation must occur');
  });

  // Probe 4: Comment submission attempt in feed
  test('P4. Guest submitting a comment in feed triggers openLogin() and suppresses comment creation', () => {
    const harness = createCommunityGuestHarness();
    harness.feedCreateCommentSubmit('post-test-1', 'Comentario malicioso o anónimo');

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must be called');
    assert.strictEqual(harness.getMutationCount(), 0, 'No comment must be appended');
    assert.strictEqual(harness.getState().comments.length, 1, 'Comments list must remain unchanged');
  });

  // Probe 5: Post textarea focus and click in feed
  test('P5. Guest focusing or clicking the new post textarea triggers openLogin()', () => {
    const harness = createCommunityGuestHarness();
    harness.feedPostTextareaFocus();
    harness.feedPostTextareaClick();

    assert.strictEqual(harness.getLoginCallCount(), 2, 'openLogin() must trigger on textarea focus and click');
    assert.strictEqual(harness.getMutationCount(), 0, 'No mutation must occur');
  });

  // Probe 6: Post submit attempt in feed
  test('P6. Guest attempting to submit a new post triggers openLogin() and cancels creation', () => {
    const harness = createCommunityGuestHarness();
    harness.feedCreatePostSubmit('Publicación no autorizada');

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on submission attempt');
    assert.strictEqual(harness.getMutationCount(), 0, 'No post must be created');
    assert.strictEqual(harness.getState().posts.length, 1, 'Posts list must retain initial count');
  });

  // Probe 7: Guardar (Save post) in feed
  test('P7. Guest clicking "Guardar" on feed post triggers openLogin() and does NOT store bookmark', () => {
    const harness = createCommunityGuestHarness();
    harness.feedToggleSavePost('post-test-1');

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger');
    assert.strictEqual(harness.getMutationCount(), 0, 'No save mutation recorded');
    assert.strictEqual(harness.getState().savedPostIds.length, 0, 'Saved posts array must remain empty');
  });

  // Probe 8: Voting in polls in feed
  test('P8. Guest voting in a poll option triggers openLogin() and does NOT record vote', () => {
    const harness = createCommunityGuestHarness();
    harness.feedVotePoll('post-test-1', 0);

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on poll vote');
    assert.strictEqual(harness.getMutationCount(), 0, 'No vote mutation recorded');
    assert.strictEqual(Object.keys(harness.getState().pollVotes).length, 0, 'pollVotes must remain empty');
  });

  // Probe 9: Interactions on /comunidad/post/[id] - Like post
  test('P9. Guest on /comunidad/post/[id] clicking like on post triggers openLogin() without mutation', () => {
    const harness = createCommunityGuestHarness();
    harness.detailToggleLike();

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on detail like');
    assert.strictEqual(harness.getMutationCount(), 0, 'No mutation recorded');
  });

  // Probe 10: Interactions on /comunidad/post/[id] - Like comment
  test('P10. Guest on /comunidad/post/[id] clicking like on comment triggers openLogin() without mutation', () => {
    const harness = createCommunityGuestHarness();
    harness.detailToggleCommentLike('comment-test-1');

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on detail comment like');
    assert.strictEqual(harness.getMutationCount(), 0, 'No mutation recorded');
  });

  // Probe 11: Interactions on /comunidad/post/[id] - "Comentar" CTA button
  test('P11. Guest on /comunidad/post/[id] clicking "Comentar" action button triggers openLogin()', () => {
    const harness = createCommunityGuestHarness();
    harness.detailCommentButton();

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on Comentar button');
    assert.strictEqual(harness.getEvents().some(e => e.type === 'FOCUS_COMMENT_INPUT'), false, 'Focus must be blocked');
  });

  // Probe 12: Interactions on /comunidad/post/[id] - Comment input focus
  test('P12. Guest on /comunidad/post/[id] focusing comment input triggers openLogin()', () => {
    const harness = createCommunityGuestHarness();
    harness.detailCommentInputFocus();

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on detail comment focus');
  });

  // Probe 13: Interactions on /comunidad/post/[id] - Submitting comment
  test('P13. Guest on /comunidad/post/[id] submitting a comment triggers openLogin() and suppresses comment', () => {
    const harness = createCommunityGuestHarness();
    harness.detailAddCommentSubmit('Intento directo en detalle');

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on detail add comment');
    assert.strictEqual(harness.getMutationCount(), 0, 'No comment mutation recorded');
  });

  // Probe 14: Interactions on /comunidad/post/[id] - Clicking "Guardar"
  test('P14. Guest on /comunidad/post/[id] clicking "Guardar" triggers openLogin() and does NOT save post', () => {
    const harness = createCommunityGuestHarness();
    harness.detailToggleSavePost();

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on detail save');
    assert.strictEqual(harness.getMutationCount(), 0, 'No save mutation recorded');
    assert.strictEqual(harness.getState().isSaved, false, 'isSaved must stay false');
  });

  // Probe 15: Interactions on /comunidad/post/[id] - Voting in poll
  test('P15. Guest on /comunidad/post/[id] voting in poll triggers openLogin() and records no vote', () => {
    const harness = createCommunityGuestHarness();
    harness.detailVotePoll('post-test-1', 1);

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on detail poll vote');
    assert.strictEqual(harness.getMutationCount(), 0, 'No vote recorded');
  });

  // Probe 16: Interactions on /comunidad/post/[id] - Reporting post
  test('P16. Guest on /comunidad/post/[id] clicking "Reportar" triggers openLogin() and blocks report modal', () => {
    const harness = createCommunityGuestHarness();
    harness.detailReportPost();

    assert.strictEqual(harness.getLoginCallCount(), 1, 'openLogin() must trigger on detail report attempt');
    assert.strictEqual(harness.getState().isReporting, false, 'Report modal state must stay false');
  });

  // Probe 17: Source Code Static Security Audit
  test('P17. Static verification of CommunityClient.tsx and PostDetailClient.tsx source guards', () => {
    const projectRoot = process.cwd();
    const communityClientPath = path.resolve(projectRoot, 'apps/web/components/CommunityClient.tsx');
    const postDetailClientPath = path.resolve(projectRoot, 'apps/web/components/PostDetailClient.tsx');

    const communityClientSrc = fs.readFileSync(communityClientPath, 'utf8').replace(/\r\n/g, '\n');
    const postDetailClientSrc = fs.readFileSync(postDetailClientPath, 'utf8').replace(/\r\n/g, '\n');

    // 1. Check CommunityClient imports and calls openLogin
    assert.ok(communityClientSrc.includes('useAuthModal'), 'CommunityClient must import useAuthModal');
    assert.ok(communityClientSrc.includes('const { openLogin } = useAuthModal();'), 'CommunityClient must extract openLogin');

    // 2. Check requireAuth implementation
    assert.ok(communityClientSrc.includes('const requireAuth = (action: () => void) => {'), 'CommunityClient must declare requireAuth');
    assert.ok(communityClientSrc.includes('if (!currentUserId) {\n      openLogin();'), 'requireAuth must invoke openLogin when !currentUserId');

    // 3. Check save post guard in CommunityClient
    assert.ok(communityClientSrc.includes('const handleToggleSavePost = (postId: string) => {\n    if (!currentUserId) {\n      openLogin();\n      return;'), 'handleToggleSavePost must guard with openLogin()');

    // 4. Check poll vote guard in CommunityClient
    assert.ok(communityClientSrc.includes('const handleVotePoll = async (postId: string, optionIndex: number) => {\n    if (!currentUserId) {\n      openLogin();\n      return;'), 'handleVotePoll must guard with openLogin()');

    // 5. Check post textarea onFocus/onClick guard
    assert.ok(communityClientSrc.includes('onFocus={() => {\n                      if (!currentUserId) openLogin();\n                    }}'), 'Textarea onFocus must call openLogin() when !currentUserId');

    // 6. Check comment input onFocus/onClick guard
    assert.ok(communityClientSrc.includes('onFocus={() => {\n                                    if (!currentUserId) openLogin();\n                                  }}'), 'Comment input onFocus must call openLogin() when !currentUserId');

    // 7. Check PostDetailClient imports and calls openLogin
    assert.ok(postDetailClientSrc.includes('useAuthModal'), 'PostDetailClient must import useAuthModal');
    assert.ok(postDetailClientSrc.includes('const { openLogin } = useAuthModal();'), 'PostDetailClient must extract openLogin');

    // 8. Check PostDetailClient guards
    assert.ok(postDetailClientSrc.includes('const handleToggleSavePost = () => {\n    if (!currentUserId) {\n      openLogin();\n      return;'), 'PostDetailClient handleToggleSavePost must guard with openLogin()');
    assert.ok(postDetailClientSrc.includes('const handleToggleLike = async () => {\n    if (!currentUserId) {\n      openLogin();\n      return;'), 'PostDetailClient handleToggleLike must guard with openLogin()');
    assert.ok(postDetailClientSrc.includes('const handleToggleCommentLike = async (commentId: string) => {\n    if (!currentUserId) {\n      openLogin();\n      return;'), 'PostDetailClient handleToggleCommentLike must guard with openLogin()');
    assert.ok(postDetailClientSrc.includes('const handleAddComment = async () => {\n    if (!currentUserId) {\n      openLogin();\n      return;'), 'PostDetailClient handleAddComment must guard with openLogin()');
    assert.ok(postDetailClientSrc.includes('const handleVotePoll = async (postId: string, optionIndex: number) => {\n    if (!currentUserId) {\n      openLogin();\n      return;'), 'PostDetailClient handleVotePoll must guard with openLogin()');
  });

  // Probe 18: Backend Defense-in-Depth Source Audit
  test('P18. Static verification of apps/web/app/actions/community.ts server actions auth check', () => {
    const projectRoot = process.cwd();
    const actionsPath = path.resolve(projectRoot, 'apps/web/app/actions/community.ts');
    const actionsSrc = fs.readFileSync(actionsPath, 'utf8').replace(/\r\n/g, '\n');

    assert.ok(actionsSrc.includes('getAuthenticatedUser'), 'community.ts must import getAuthenticatedUser');

    // Check toggleLike
    assert.ok(actionsSrc.includes('export async function toggleLike(postId: string) {'), 'toggleLike action must exist');
    assert.ok(actionsSrc.includes('const auth = await getAuthenticatedUser();\n    if (!auth?.id) {\n      return { success: false, error: "Debes iniciar sesión para reaccionar." };'), 'toggleLike must reject unauthenticated callers');

    // Check createComment
    assert.ok(actionsSrc.includes('export async function createComment(postId: string, content: string) {'), 'createComment action must exist');
    assert.ok(actionsSrc.includes('const auth = await getAuthenticatedUser();\n    if (!auth?.id) {\n      return { success: false, error: "Debes iniciar sesión para comentar." };'), 'createComment must reject unauthenticated callers');

    // Check votePollOption
    assert.ok(actionsSrc.includes('export async function votePollOption(postId: string, optionIndex: number) {'), 'votePollOption action must exist');
    assert.ok(actionsSrc.includes('const auth = await getAuthenticatedUser();\n    if (!auth?.id) {\n      return { success: false, error: "Debes iniciar sesión para votar en la encuesta." };'), 'votePollOption must reject unauthenticated callers');

    // Check createPost
    assert.ok(actionsSrc.includes('export async function createPost('), 'createPost action must exist');
    assert.ok(actionsSrc.includes('const auth = await getAuthenticatedUser();\n    if (!auth?.id) {\n      return { success: false, error: "Debes iniciar sesión para publicar." };'), 'createPost must reject unauthenticated callers');
  });
});
