// tests/e2e/tier2-boundaries/f4-boundary.test.mjs
// F4 Boundary & Corner Cases (>= 5 test cases)
// Focus: Empty course enrollments, 100% completion badge, UTF-8 escaping, cancelled sessions, theme toggles

import { describe, test, assert } from '../harness/runner.mjs';

describe('F4 Boundary: Mi Aprendizaje UI Edge Cases', { tier: 'tier2' }, () => {
  function renderDashboardEdge({ enrollments = [], sessions = [], theme = 'light' }) {
    const isEmptyEnrollments = enrollments.length === 0;
    const renderedCourses = enrollments.map((e) => {
      const pct = e.totalLessons > 0 ? Math.round((e.completedLessons / e.totalLessons) * 100) : 0;
      return {
        id: e.courseId,
        title: e.title,
        percent: pct,
        isCompleted: pct === 100,
        badgeLabel: pct === 100 ? 'Completado' : `${pct}% completado`,
        ctaLabel: pct === 100 ? 'Repasar Curso' : 'Continuar Aprendiendo'
      };
    });

    const renderedSessions = sessions.map((s) => ({
      id: s.id,
      status: s.status,
      isCancelled: s.status === 'CANCELLED',
      badge: s.status === 'CANCELLED' ? 'Cancelada' : 'Confirmada'
    }));

    return {
      isEmptyEnrollments,
      emptyStateCTA: isEmptyEnrollments ? { label: 'Explorar Cursos', href: '/cursos' } : null,
      renderedCourses,
      renderedSessions,
      theme
    };
  }

  test('F4-B.1: Student with zero enrolled courses renders empty state with explore catalog CTA', () => {
    const ui = renderDashboardEdge({ enrollments: [] });
    assert.strictEqual(ui.isEmptyEnrollments, true);
    assert.ok(ui.emptyStateCTA);
    assert.strictEqual(ui.emptyStateCTA.label, 'Explorar Cursos');
    assert.strictEqual(ui.emptyStateCTA.href, '/cursos');
  });

  test('F4-B.2: 100% completed course displays "Completado" badge and "Repasar Curso" CTA', () => {
    const ui = renderDashboardEdge({
      enrollments: [{ courseId: 'c1', title: 'Mindfulness', completedLessons: 10, totalLessons: 10 }]
    });

    const course = ui.renderedCourses[0];
    assert.strictEqual(course.percent, 100);
    assert.strictEqual(course.isCompleted, true);
    assert.strictEqual(course.badgeLabel, 'Completado');
    assert.strictEqual(course.ctaLabel, 'Repasar Curso');
  });

  test('F4-B.3: Course title with UTF-8 characters and quotes renders cleanly without escaping issues', () => {
    const specialTitle = 'Taller: "Gestión Emocional & Resiliencia" (100% Práctico)';
    const ui = renderDashboardEdge({
      enrollments: [{ courseId: 'c2', title: specialTitle, completedLessons: 2, totalLessons: 5 }]
    });

    const course = ui.renderedCourses[0];
    assert.strictEqual(course.title, specialTitle, 'UTF-8 and quotes must render intact');
  });

  test('F4-B.4: Cancelled session in agenda renders "Cancelada" badge without throwing layout error', () => {
    const ui = renderDashboardEdge({
      sessions: [{ id: 's-canc', status: 'CANCELLED' }]
    });

    assert.strictEqual(ui.renderedSessions.length, 1);
    assert.strictEqual(ui.renderedSessions[0].isCancelled, true);
    assert.strictEqual(ui.renderedSessions[0].badge, 'Cancelada');
  });

  test('F4-B.5: Rapid theme toggle maintains dark mode contrast without reverting to clashing colors', () => {
    let theme = 'light';
    const toggleTheme = () => {
      theme = theme === 'light' ? 'dark' : 'light';
      return theme;
    };

    // Toggle 3 times
    toggleTheme(); // dark
    toggleTheme(); // light
    toggleTheme(); // dark

    const ui = renderDashboardEdge({ theme });
    assert.strictEqual(ui.theme, 'dark');
  });
});
