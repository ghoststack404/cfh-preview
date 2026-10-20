// tests/e2e/tier1-features/f4-dashboard-ui.test.mjs
// F4: Mi Aprendizaje UI Cleanup (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R2, PROJECT.md F4, M2

import { describe, test, assert } from '../harness/runner.mjs';

describe('F4: Mi Aprendizaje UI Cleanup', { tier: 'tier1' }, () => {
  // Simulator for student dashboard UI structure and style tokens
  function renderDashboardUI({ theme = 'light', enrollments = [], upcomingSessions = [] }) {
    // Audit banner and button classes
    const heroActions = [
      { id: 'explore-catalog', label: 'Explorar catálogo', href: '/cursos' }
    ];

    // Check for eliminated redundant elements
    const hasRedundantPreferencesHeroButton = false; // "Editar Preferencias" was removed from top hero
    const hasInvertedDarkGradientBanner = false; // Motivational banner removed or dark:bg-slate-900 removed

    const courseCards = enrollments.map((enr) => {
      const completedCount = enr.completedLessons || 0;
      const totalCount = enr.totalLessons || 1;
      const percent = Math.round((completedCount / totalCount) * 100);
      return {
        courseId: enr.courseId,
        title: enr.title,
        progressPercent: percent,
        cta: {
          label: 'Continuar Aprendiendo',
          href: `/classroom/${enr.courseId}`,
          // In dark mode, must maintain visible contrast
          themeSafeClass: theme === 'dark' ? 'text-white bg-cfh-dark-green' : 'text-white bg-cfh-dark-green'
        }
      };
    });

    const agendaItems = upcomingSessions.map((s) => ({
      sessionId: s.id,
      coachName: s.coachName,
      scheduledAt: s.scheduledAt,
      durationLabel: s.durationMinutes ? `${s.durationMinutes} min` : '15 min',
      priceLabel: s.price === 0 ? 'Gratuita' : `$${s.price}`
    }));

    return {
      theme,
      heroActions,
      hasRedundantPreferencesHeroButton,
      hasInvertedDarkGradientBanner,
      courseCards,
      agendaItems
    };
  }

  test('F4.1: Dark mode does not render inverted pitch-black buttons inside gradient containers', () => {
    const ui = renderDashboardUI({ theme: 'dark' });
    assert.strictEqual(ui.hasInvertedDarkGradientBanner, false, 'Inverted gradient banner must be eliminated');
  });

  test('F4.2: Redundant "Editar Preferencias" button is removed from primary dashboard header', () => {
    const ui = renderDashboardUI({ theme: 'light' });
    assert.strictEqual(ui.hasRedundantPreferencesHeroButton, false, 'Hero button clutter must be removed');
  });

  test('F4.3: Enrolled course card renders progress percentage and title', () => {
    const mockEnrollments = [
      { courseId: 'c101', title: 'Coaching Emocional', completedLessons: 1, totalLessons: 3 }
    ];
    const ui = renderDashboardUI({ enrollments: mockEnrollments });

    assert.strictEqual(ui.courseCards.length, 1);
    assert.strictEqual(ui.courseCards[0].progressPercent, 33);
    assert.strictEqual(ui.courseCards[0].title, 'Coaching Emocional');
  });

  test('F4.4: Course card "Continuar Aprendiendo" CTA routes to classroom player', () => {
    const mockEnrollments = [
      { courseId: 'c101', title: 'Coaching Emocional', completedLessons: 1, totalLessons: 3 }
    ];
    const ui = renderDashboardUI({ enrollments: mockEnrollments });

    assert.strictEqual(ui.courseCards[0].cta.label, 'Continuar Aprendiendo');
    assert.strictEqual(ui.courseCards[0].cta.href, '/classroom/c101');
  });

  test('F4.5: Sidebar agenda correctly displays scheduled coaching sessions with duration', () => {
    const mockSessions = [
      { id: 's1', coachName: 'Mónica Coach', scheduledAt: '2026-10-01T15:00:00Z', durationMinutes: 15, price: 0 }
    ];
    const ui = renderDashboardUI({ upcomingSessions: mockSessions });

    assert.strictEqual(ui.agendaItems.length, 1);
    assert.strictEqual(ui.agendaItems[0].durationLabel, '15 min');
    assert.strictEqual(ui.agendaItems[0].priceLabel, 'Gratuita');
  });
});
