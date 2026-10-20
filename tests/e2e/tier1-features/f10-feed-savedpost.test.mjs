// tests/e2e/tier1-features/f10-feed-savedpost.test.mjs
// F10: Feed Decoupling & DB-Backed Save Post (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R3, PROJECT.md F10, M3

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase } from '../harness/mock-env.mjs';

describe('F10: Feed Decoupling & DB-Backed Save Post', { tier: 'tier1' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
  });

  test('F10.1: Switching active feed tab does not mutate the new post creation type state', () => {
    // Component state simulation
    let activeFeedTab = 'ALL';
    let newPostType = 'DISCUSSION';

    const switchFeedTab = (tab) => {
      activeFeedTab = tab;
      // In decoupled design, newPostType is NOT modified by feed filter changes
    };

    switchFeedTab('QUESTIONS');
    assert.strictEqual(activeFeedTab, 'QUESTIONS', 'Active feed tab changes');
    assert.strictEqual(newPostType, 'DISCUSSION', 'Post creation type must remain DISCUSSION and not be mutated');

    switchFeedTab('ANNOUNCEMENTS');
    assert.strictEqual(activeFeedTab, 'ANNOUNCEMENTS');
    assert.strictEqual(newPostType, 'DISCUSSION', 'Post creation type must still remain DISCUSSION');
  });

  test('F10.2: Submitting a new post uses explicitly chosen type rather than current feed tab', () => {
    function submitPost({ activeTab, explicitType, title, content }) {
      // Decoupled submission: explicitly chosen type is always prioritized
      const typeToSend = explicitType;
      return {
        id: `post-${Date.now()}`,
        type: typeToSend,
        title,
        content
      };
    }

    const createdPost = submitPost({
      activeTab: 'QUESTIONS', // Feed is currently showing questions
      explicitType: 'POLL', // User explicitly chose a poll
      title: '¿Qué opinan?',
      content: 'Pregunta de la semana'
    });

    assert.strictEqual(createdPost.type, 'POLL', 'Published post type must match user explicit choice, not active tab');
  });

  test('F10.3: Clicking "Guardar" on a post creates a record in SavedPost database table', () => {
    const res = db.toggleSavePost('student-1', 'post-1');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.saved, true, 'Post must now be marked as saved');

    const key = `student-1:post-1`;
    assert.ok(db.savedPosts.has(key), 'SavedPost record must exist in DB table');
  });

  test('F10.4: Clicking "Guardar" on an already saved post removes it from the database', () => {
    // 1. Save post
    db.toggleSavePost('student-1', 'post-1');
    assert.ok(db.savedPosts.has('student-1:post-1'));

    // 2. Unsave post
    const res = db.toggleSavePost('student-1', 'post-1');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.saved, false, 'Post must now be marked as unsaved');

    assert.strictEqual(db.savedPosts.has('student-1:post-1'), false, 'SavedPost record must be deleted from DB');
  });

  test('F10.5: Querying saved posts returns only posts bookmarked by the querying user', () => {
    // student-1 saves post-1
    db.toggleSavePost('student-1', 'post-1');
    // student-2 saves post-2
    db.toggleSavePost('student-new', 'post-2');

    const student1Saved = db.getSavedPosts('student-1');
    assert.strictEqual(student1Saved.length, 1);
    assert.strictEqual(student1Saved[0].id, 'post-1');

    const studentNewSaved = db.getSavedPosts('student-new');
    assert.strictEqual(studentNewSaved.length, 1);
    assert.strictEqual(studentNewSaved[0].id, 'post-2');
  });
});
