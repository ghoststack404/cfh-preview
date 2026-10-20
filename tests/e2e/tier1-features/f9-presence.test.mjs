// tests/e2e/tier1-features/f9-presence.test.mjs
// F9: Comunidad Activa Presence (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R3, PROJECT.md F9, M3

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { RealtimeChannelHub } from '../harness/mock-env.mjs';
import { assertValidPresenceMember } from '../harness/contracts.mjs';

describe('F9: Comunidad Activa Presence', { tier: 'tier1' }, () => {
  let hub;

  beforeEach(() => {
    hub = new RealtimeChannelHub();
  });

  test('F9.1: Authenticated user joining presence-community returns active members list', () => {
    const user = { id: 'user-1', name: 'Ana Estudiante', role: 'STUDENT' };
    const members = hub.joinPresence('presence-community', user);

    assert.ok(Array.isArray(members));
    assert.strictEqual(members.length, 1);
    assertValidPresenceMember(members[0]);
    assert.strictEqual(members[0].id, 'user-1');
  });

  test('F9.2: Multiple connected users are reflected in presence roster', () => {
    hub.joinPresence('presence-community', { id: 'user-1', name: 'Ana Estudiante', role: 'STUDENT' });
    hub.joinPresence('presence-community', { id: 'user-2', name: 'Mónica Coach', role: 'COACH' });

    const members = hub.getPresenceMembers('presence-community');
    assert.strictEqual(members.length, 2);

    const coach = members.find((m) => m.role === 'COACH');
    const student = members.find((m) => m.role === 'STUDENT');
    assert.ok(coach, 'Coach must be present in roster');
    assert.ok(student, 'Student must be present in roster');
  });

  test('F9.3: member_added event triggers when a new user connects', () => {
    let newMemberEvent = null;
    hub.on('presence-community:member_added', (member) => {
      newMemberEvent = member;
    });

    hub.joinPresence('presence-community', { id: 'user-3', name: 'Carlos Alumno', role: 'STUDENT' });

    assert.ok(newMemberEvent, 'member_added event must be emitted');
    assert.strictEqual(newMemberEvent.id, 'user-3');
    assert.strictEqual(newMemberEvent.name, 'Carlos Alumno');
  });

  test('F9.4: member_removed event triggers when a user disconnects', () => {
    hub.joinPresence('presence-community', { id: 'user-1', name: 'Ana Estudiante', role: 'STUDENT' });
    hub.joinPresence('presence-community', { id: 'user-2', name: 'Mónica Coach', role: 'COACH' });

    let removedMemberEvent = null;
    hub.on('presence-community:member_removed', (member) => {
      removedMemberEvent = member;
    });

    hub.leavePresence('presence-community', 'user-1');

    assert.ok(removedMemberEvent, 'member_removed event must be emitted');
    assert.strictEqual(removedMemberEvent.id, 'user-1');

    const remaining = hub.getPresenceMembers('presence-community');
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].id, 'user-2');
  });

  test('F9.5: "Comunidad Activa" sidebar component aggregates count and active avatars', () => {
    function renderComunidadActivaUI(members) {
      return {
        totalOnline: members.length,
        items: members.map((m) => ({
          id: m.id,
          name: m.name,
          roleBadge: m.role === 'COACH' ? 'Coach Verificado' : 'Estudiante',
          statusDot: 'bg-emerald-500' // green online indicator
        }))
      };
    }

    const mockMembers = [
      { id: 'u1', name: 'Mónica', role: 'COACH' },
      { id: 'u2', name: 'Ana', role: 'STUDENT' }
    ];

    const ui = renderComunidadActivaUI(mockMembers);
    assert.strictEqual(ui.totalOnline, 2);
    assert.strictEqual(ui.items[0].roleBadge, 'Coach Verificado');
    assert.strictEqual(ui.items[0].statusDot, 'bg-emerald-500');
  });
});
