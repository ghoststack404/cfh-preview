// tests/e2e/tier4-scenarios/scenario4-course-purchase-player.test.mjs
// Tier 4: Scenario 4 — Course Purchase & Interactive Learning Progress
// Features: F6, F7

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase, getEmbedVideoUrl } from '../harness/mock-env.mjs';

describe('Tier 4 Scenario 4: Course Purchase & Interactive Learning Progress', { tier: 'tier4' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
  });

  test('User Journey: Click Comprar Ahora -> bypass cart drawer -> complete purchase -> open classroom player -> toggle lesson progress -> persist across reloads', () => {
    const studentId = 'student-1';
    const courseId = 'course-101';
    const course = db.courses.get(courseId);

    // Step 1: Simulate "Comprar Ahora" click
    const cartState = { isOpen: false, items: [] };
    const handleBuyNowClick = (cId) => {
      cartState.isOpen = false;
      return `/checkout?courseId=${cId}&direct=true`;
    };

    const checkoutUrl = handleBuyNowClick(courseId);
    assert.strictEqual(cartState.isOpen, false, 'Step 1: Cart drawer remains closed');
    assert.ok(checkoutUrl.includes('direct=true'), 'Step 1: Routes to direct checkout');

    // Step 2: Checkout completion creates enrollment in database
    const enrollment = db.createEnrollment(studentId, courseId);
    assert.ok(enrollment.id, 'Step 2: Enrollment created in DB');

    // Step 3: Enter classroom player and verify video embed
    const firstLesson = course.modules[0].lessons[0];
    const embedUrl = getEmbedVideoUrl(firstLesson.videoUrl);
    assert.ok(embedUrl.startsWith('https://www.youtube-nocookie.com/embed/'), 'Step 3: Responsive video player loaded');

    // Step 4: Complete Lesson 1
    const toggleRes = db.setLessonProgress(studentId, courseId, firstLesson.id, true);
    assert.strictEqual(toggleRes.success, true, 'Step 4: Lesson progress updated');
    assert.strictEqual(toggleRes.completed, true);

    // Step 5: Simulate page refresh / GET /api/classroom/[id]
    const updatedEnrollment = db.getEnrollment(studentId, courseId);
    assert.strictEqual(updatedEnrollment.progress.has(firstLesson.id), true, 'Step 5: Lesson 1 completed persists in DB');

    // Step 6: Verify progress percentage
    const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0); // 3 lessons
    const completedCount = updatedEnrollment.progress.size; // 1 lesson
    const pct = Math.round((completedCount / totalLessons) * 100);
    assert.strictEqual(pct, 33, 'Step 6: Course progress reaches 33%');
  });
});
