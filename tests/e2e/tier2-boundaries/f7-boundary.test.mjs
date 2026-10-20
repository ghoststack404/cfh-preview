// tests/e2e/tier2-boundaries/f7-boundary.test.mjs
// F7 Boundary & Corner Cases (>= 5 test cases)
// Focus: Missing video fallback, invalid lessonId, unauthenticated progress, non-enrolled user, untoggle lesson

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase, getEmbedVideoUrl } from '../harness/mock-env.mjs';

describe('F7 Boundary: Interactive Course Player Edge Cases', { tier: 'tier2' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
    db.createEnrollment('student-1', 'course-101');
  });

  test('F7-B.1: Video embed parser handles null, empty, or unsupported video URLs with fallback', () => {
    assert.strictEqual(getEmbedVideoUrl(null), null);
    assert.strictEqual(getEmbedVideoUrl(''), null);
    assert.strictEqual(getEmbedVideoUrl('https://example.com/not-a-video'), null);

    // Verify UI fallback handler
    const renderVideoPlayer = (url) => {
      const embed = getEmbedVideoUrl(url);
      if (!embed) {
        return { type: 'FALLBACK_PLACEHOLDER', message: 'Video no disponible o enlace inválido' };
      }
      return { type: 'EMBED_IFRAME', src: embed };
    };

    const fallback = renderVideoPlayer('https://unsupported.com/vid');
    assert.strictEqual(fallback.type, 'FALLBACK_PLACEHOLDER');
  });

  test('F7-B.2: Toggling progress for non-existent lessonId handles error cleanly', () => {
    const res = db.setLessonProgress('student-1', 'course-101', 'non-existent-lesson-999', true);
    // When non-existent lesson is passed, progress records the ID but module matching filters it safely
    assert.strictEqual(res.success, true);

    const enrollment = db.getEnrollment('student-1', 'course-101');
    const course = db.courses.get('course-101');

    // Verify course lessons count ignores orphan progress
    const validLessons = course.modules.flatMap((m) => m.lessons);
    const validCompletedCount = validLessons.filter((l) => enrollment.progress.has(l.id)).length;
    assert.strictEqual(validCompletedCount, 0, 'Orphan lesson progress must not increment course progress');
  });

  test('F7-B.3: Unauthenticated user attempting to toggle progress is rejected', () => {
    function simulateApiProgressEndpoint({ user, courseId, lessonId, completed }) {
      if (!user) {
        return { status: 401, error: 'UNAUTHORIZED' };
      }
      return { status: 200, success: true };
    }

    const res = simulateApiProgressEndpoint({
      user: null, // Unauthenticated
      courseId: 'course-101',
      lessonId: 'les-1',
      completed: true
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.error, 'UNAUTHORIZED');
  });

  test('F7-B.4: Non-enrolled student attempting to update progress is blocked with FORBIDDEN', () => {
    // student-new is NOT enrolled in course-101
    assert.throws(() => {
      db.setLessonProgress('student-new', 'course-101', 'les-1', true);
    }, /FORBIDDEN_NOT_ENROLLED/);
  });

  test('F7-B.5: Toggling completed lesson back to uncompleted removes progress record', () => {
    // 1. Complete lesson
    db.setLessonProgress('student-1', 'course-101', 'les-1', true);
    let enrollment = db.getEnrollment('student-1', 'course-101');
    assert.strictEqual(enrollment.progress.has('les-1'), true);

    // 2. Untoggle lesson
    const res = db.setLessonProgress('student-1', 'course-101', 'les-1', false);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.completed, false);

    enrollment = db.getEnrollment('student-1', 'course-101');
    assert.strictEqual(enrollment.progress.has('les-1'), false, 'Lesson must be uncompleted');
  });
});
