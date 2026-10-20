// tests/e2e/tier4-scenarios/scenario5-live-chat-messaging.test.mjs
// Tier 4: Scenario 5 — Live Chat Messaging between Student and Coach
// Features: F8, F9

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { RealtimeChannelHub, scanContactPolicy } from '../harness/mock-env.mjs';

describe('Tier 4 Scenario 5: Live Chat Messaging between Student and Coach', { tier: 'tier4' }, () => {
  let hub;

  beforeEach(() => {
    hub = new RealtimeChannelHub();
  });

  test('User Journey: Both parties connect -> presence confirms online status -> student sends message -> policy check -> real-time dispatch -> coach receives without reload -> coach replies', () => {
    const student = { id: 'student-1', name: 'Ana Estudiante', role: 'STUDENT' };
    const coach = { id: 'coach-1', name: 'Mónica Coach', role: 'COACH' };
    const conversationId = 'conv-scenario-5';
    const channelName = `private-conversation-${conversationId}`;

    // Step 1: Both parties join community presence
    hub.joinPresence('presence-community', student);
    hub.joinPresence('presence-community', coach);

    const members = hub.getPresenceMembers('presence-community');
    assert.strictEqual(members.length, 2, 'Step 1: Both members connected to presence');

    // Step 2: Set up chat UI message listeners
    const studentChatUI = { messages: [] };
    const coachChatUI = { messages: [] };

    hub.on(`${channelName}:new-message`, (msg) => {
      // Both student and coach listeners receive broadcast
      coachChatUI.messages.push(msg);
      studentChatUI.messages.push(msg);
    });

    // Step 3: Student writes message and policy scanner validates content
    const studentMessageContent = 'Hola Mónica, tengo una duda sobre la sesión de mañana a las 3pm.';
    const policy = scanContactPolicy(studentMessageContent);
    assert.strictEqual(policy.allowed, true, 'Step 2: Message passes safety policy');

    // Step 4: Dispatch message via WebSocket
    const msg1 = {
      id: 'msg-s1',
      conversationId,
      senderId: student.id,
      content: studentMessageContent,
      createdAt: new Date().toISOString()
    };
    hub.broadcastMessage(conversationId, msg1);

    // Step 5: Coach receives message in real time without page reload
    assert.strictEqual(coachChatUI.messages.length, 1, 'Step 3: Coach receives message via WebSocket');
    assert.strictEqual(coachChatUI.messages[0].content, studentMessageContent);

    // Step 6: Coach replies
    const coachReplyContent = '¡Hola Ana! Claro que sí, revisaremos ese tema al inicio.';
    const msg2 = {
      id: 'msg-c1',
      conversationId,
      senderId: coach.id,
      content: coachReplyContent,
      createdAt: new Date().toISOString()
    };
    hub.broadcastMessage(conversationId, msg2);

    // Step 7: Verify two-way instant synchronization
    assert.strictEqual(studentChatUI.messages.length, 2, 'Step 4: Student receives coach reply instantly');
    assert.strictEqual(studentChatUI.messages[1].content, coachReplyContent);
    assert.strictEqual(coachChatUI.messages.length, 2, 'Step 4: Coach view synchronizes');
  });
});
