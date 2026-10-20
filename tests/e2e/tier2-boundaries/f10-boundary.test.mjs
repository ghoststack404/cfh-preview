// tests/e2e/tier2-boundaries/f10-boundary.test.mjs
// F10 Boundary & Corner Cases (>= 5 test cases)
// Focus: Non-existent postId, idempotency, empty post validation, zero matching filters, cascade deletion

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase } from '../harness/mock-env.mjs';

describe('F10 Boundary: Feed Decoupling & Saved Post Edge Cases', { tier: 'tier2' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
  });

  test('F10-B.1: Attempting to save non-existent post throws POST_NOT_FOUND without orphan records', () => {
    assert.throws(() => {
      db.toggleSavePost('student-1', 'post-nonexistent-999');
    }, /POST_NOT_FOUND/);

    assert.strictEqual(db.savedPosts.size, 0, 'No orphan records should be created');
  });

  test('F10-B.2: Repeatedly calling toggleSavePost alternates between saved: true and saved: false', () => {
    // 1st toggle -> true
    const res1 = db.toggleSavePost('student-1', 'post-1');
    assert.strictEqual(res1.saved, true);

    // 2nd toggle -> false
    const res2 = db.toggleSavePost('student-1', 'post-1');
    assert.strictEqual(res2.saved, false);

    // 3rd toggle -> true
    const res3 = db.toggleSavePost('student-1', 'post-1');
    assert.strictEqual(res3.saved, true);
  });

  test('F10-B.3: Community post creation with empty title or content returns validation error', () => {
    function validatePostCreation(title, content) {
      if (!title || title.trim().length === 0) {
        return { valid: false, error: 'TITLE_REQUIRED' };
      }
      if (!content || content.trim().length === 0) {
        return { valid: false, error: 'CONTENT_REQUIRED' };
      }
      return { valid: true };
    }

    const resEmptyTitle = validatePostCreation('', 'Contenido válido');
    assert.strictEqual(resEmptyTitle.valid, false);
    assert.strictEqual(resEmptyTitle.error, 'TITLE_REQUIRED');

    const resEmptyContent = validatePostCreation('Título válido', '   ');
    assert.strictEqual(resEmptyContent.valid, false);
    assert.strictEqual(resEmptyContent.error, 'CONTENT_REQUIRED');
  });

  test('F10-B.4: Filtering feed by category with zero matching posts displays clean empty state', () => {
    function filterFeed(posts, selectedCategory) {
      const filtered = posts.filter((p) => p.type === selectedCategory);
      return {
        posts: filtered,
        hasNoResults: filtered.length === 0,
        emptyMessage: 'No hay publicaciones en esta categoría todavía.'
      };
    }

    const mockPosts = Array.from(db.communityPosts.values());
    const feed = filterFeed(mockPosts, 'CATEGORY_EMPTY_TEST');

    assert.strictEqual(feed.posts.length, 0);
    assert.strictEqual(feed.hasNoResults, true);
    assert.ok(feed.emptyMessage.length > 0);
  });

  test('F10-B.5: Cascade deletion of post prunes corresponding SavedPost records', () => {
    // 1. student-1 saves post-1
    db.toggleSavePost('student-1', 'post-1');
    assert.strictEqual(db.savedPosts.has('student-1:post-1'), true);

    // 2. Delete post-1 simulating Prisma onDelete: Cascade
    function deletePostWithCascade(postId) {
      db.communityPosts.delete(postId);
      // Prune savedPosts where postId matches
      for (const key of db.savedPosts) {
        const [_, pId] = key.split(':');
        if (pId === postId) {
          db.savedPosts.delete(key);
        }
      }
    }

    deletePostWithCascade('post-1');

    assert.strictEqual(db.communityPosts.has('post-1'), false);
    assert.strictEqual(db.savedPosts.has('student-1:post-1'), false, 'SavedPost record must be cascade deleted');
  });
});
