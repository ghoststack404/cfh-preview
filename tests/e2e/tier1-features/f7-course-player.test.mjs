// tests/e2e/tier1-features/f7-course-player.test.mjs
// F7: Interactive Course Player & Progress Persistence (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R2, PROJECT.md F7, M2

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { MockDatabase, getEmbedVideoUrl } from '../harness/mock-env.mjs';
import { assertValidProgressToggleResponse } from '../harness/contracts.mjs';

describe('F7: Interactive Course Player & Progress Persistence', { tier: 'tier1' }, () => {
  let db;

  beforeEach(() => {
    db = new MockDatabase();
    // Enroll student in course-101
    db.createEnrollment('student-1', 'course-101');
  });

  test('F7.1: YouTube lesson video URL transforms to valid responsive embed player URL', () => {
    const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const embed = getEmbedVideoUrl(ytUrl);

    assert.ok(embed, 'Embed URL must not be null');
    assert.ok(embed.startsWith('https://www.youtube-nocookie.com/embed/'), 'Must use youtube-nocookie embed format');
    assert.ok(embed.includes('dQw4w9WgXcQ'), 'Must preserve video ID');
  });

  test('F7.2: Vimeo lesson video URL transforms to valid responsive embed player URL', () => {
    const vimeoUrl = 'https://vimeo.com/76979871';
    const embed = getEmbedVideoUrl(vimeoUrl);

    assert.ok(embed, 'Embed URL must not be null');
    assert.strictEqual(embed, 'https://player.vimeo.com/video/76979871');
  });

  test('F7.3: Marking a lesson completed persists to LessonProgress in database', () => {
    const res = db.setLessonProgress('student-1', 'course-101', 'les-1', true);

    assertValidProgressToggleResponse(res);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.completed, true);

    const enrollment = db.getEnrollment('student-1', 'course-101');
    assert.ok(enrollment.progress.has('les-1'), 'Lesson progress must be recorded in enrollment');
  });

  test('F7.4: Refreshing classroom data reflects previously completed lesson state', () => {
    // 1. Mark lesson 1 completed
    db.setLessonProgress('student-1', 'course-101', 'les-1', true);

    // 2. Simulate GET /api/classroom/course-101
    const enrollment = db.getEnrollment('student-1', 'course-101');
    const course = db.courses.get('course-101');

    const sections = course.modules.map((mod) => ({
      id: mod.id,
      title: mod.title,
      lessons: mod.lessons.map((les) => ({
        id: les.id,
        title: les.title,
        completed: enrollment.progress.has(les.id)
      }))
    }));

    const lesson1 = sections[0].lessons.find((l) => l.id === 'les-1');
    const lesson2 = sections[0].lessons.find((l) => l.id === 'les-2');

    assert.strictEqual(lesson1.completed, true, 'Lesson 1 must remain completed upon refresh');
    assert.strictEqual(lesson2.completed, false, 'Lesson 2 must remain uncompleted');
  });

  test('F7.5: Completing all lessons in a module marks module as complete', () => {
    // Mark both lessons in module 1 completed
    db.setLessonProgress('student-1', 'course-101', 'les-1', true);
    db.setLessonProgress('student-1', 'course-101', 'les-2', true);

    const enrollment = db.getEnrollment('student-1', 'course-101');
    const course = db.courses.get('course-101');
    const mod1 = course.modules[0];

    const isModuleComplete = mod1.lessons.every((l) => enrollment.progress.has(l.id));
    assert.strictEqual(isModuleComplete, true, 'Module 1 should be complete when all its lessons are done');
  });
});
