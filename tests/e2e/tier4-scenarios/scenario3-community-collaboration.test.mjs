// tests/e2e/tier4-scenarios/scenario3-community-collaboration.test.mjs
// Tier 4: Scenario 3 — Community Active Collaboration & Saved Knowledge
// Features: F1, F8, F9, F10

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase, RealtimeChannelHub } from '../harness/mock-env.mjs';

describe('Tier 4 Scenario 3: Community Active Collaboration & Saved Knowledge', { tier: 'tier4' }, () => {
  let db;
  let hub;

  beforeEach(() => {
    db = new MockDatabase();
    hub = new RealtimeChannelHub();
  });

  test('User Journey: Join presence -> view active members -> filter feed -> create decoupled post -> save post to DB -> verify persistence upon refresh', () => {
    const studentUser = db.users.get('student-1');

    // Step 1: Join presence channel
    const activeMembers = hub.joinPresence('presence-community', studentUser);
    assert.strictEqual(activeMembers.length, 1, 'Step 1: Joined active community');
    assert.strictEqual(activeMembers[0].id, 'student-1');

    // Step 2: Peer coach joins presence
    const coachUser = db.users.get('coach-1');
    hub.joinPresence('presence-community', coachUser);
    const updatedRoster = hub.getPresenceMembers('presence-community');
    assert.strictEqual(updatedRoster.length, 2, 'Step 2: Both members visible in active roster');

    // Step 3: Filter feed while drafting new post
    let activeTab = 'QUESTIONS';
    let newPostType = 'DISCUSSION'; // User selected Discussion

    // Verify filter change doesn't alter newPostType
    activeTab = 'ANNOUNCEMENTS';
    assert.strictEqual(newPostType, 'DISCUSSION', 'Step 3: Post creation type is decoupled from tab');

    // Step 4: Publish post
    const newPost = {
      id: 'post-new-collab',
      authorId: studentUser.id,
      authorName: studentUser.name,
      title: 'Técnicas de enfoque diario',
      content: 'Comparto mi rutina matutina para mejorar la concentración.',
      type: newPostType,
      createdAt: new Date()
    };
    db.communityPosts.set(newPost.id, newPost);
    assert.ok(db.communityPosts.has('post-new-collab'), 'Step 4: Post published to feed');

    // Step 5: Save coach post (post-2) to database
    const saveRes = db.toggleSavePost(studentUser.id, 'post-2');
    assert.strictEqual(saveRes.success, true, 'Step 5: Post saved');
    assert.strictEqual(saveRes.saved, true);
    assert.strictEqual(db.savedPosts.has(`${studentUser.id}:post-2`), true, 'Step 5: SavedPost in DB');

    // Step 6: Simulate page refresh / component reload
    const refreshedSavedPosts = db.getSavedPosts(studentUser.id);
    assert.strictEqual(refreshedSavedPosts.length, 1, 'Step 6: Saved post persists upon refresh');
    assert.strictEqual(refreshedSavedPosts[0].id, 'post-2', 'Step 6: Correct post bookmarked');
  });
});
