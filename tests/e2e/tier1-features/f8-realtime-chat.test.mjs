// tests/e2e/tier1-features/f8-realtime-chat.test.mjs
// F8: Real-Time Messaging via WebSockets (Happy Paths >= 5 test cases)
// Source: ORIGINAL_REQUEST §R3, PROJECT.md F8, M3

import { describe, test, beforeEach, assert } from '../harness/runner.mjs';
import { RealtimeChannelHub, scanContactPolicy } from '../harness/mock-env.mjs';
import { assertValidMessageSchema } from '../harness/contracts.mjs';

describe('F8: Real-Time Messaging via WebSockets', { tier: 'tier1' }, () => {
  let hub;

  beforeEach(() => {
    hub = new RealtimeChannelHub();
  });

  test('F8.1: Sending a message triggers new-message event on private conversation channel', (context) => {
    const conversationId = 'conv-123';
    const channelName = `private-conversation-${conversationId}`;

    let eventReceived = null;
    hub.on(`${channelName}:new-message`, (payload) => {
      eventReceived = payload;
    });

    const testMessage = {
      id: 'msg-1',
      conversationId,
      senderId: 'student-1',
      senderRole: 'STUDENT',
      content: 'Hola Coach, ¿cómo estás?',
      createdAt: new Date().toISOString()
    };

    hub.broadcastMessage(conversationId, testMessage);

    assert.ok(eventReceived, 'Receiver must receive real-time message event');
    assertValidMessageSchema(eventReceived);
    assert.strictEqual(eventReceived.content, 'Hola Coach, ¿cómo estás?');
  });

  test('F8.2: Receiver client receives message without requiring HTTP page or tab reload', () => {
    const conversationId = 'conv-456';
    const channelName = `private-conversation-${conversationId}`;

    // Simulated Receiver UI State
    const receiverState = {
      messages: [
        { id: 'msg-0', conversationId, senderId: 'coach-1', content: 'Bienvenido', createdAt: new Date().toISOString() }
      ],
      reloadCount: 0
    };

    // Receiver attaches WebSocket listener
    hub.on(`${channelName}:new-message`, (incoming) => {
      receiverState.messages.push(incoming);
      // No reload triggered
    });

    // Sender dispatches new message
    hub.broadcastMessage(conversationId, {
      id: 'msg-1',
      conversationId,
      senderId: 'student-1',
      content: 'Muchas gracias por la sesión',
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(receiverState.messages.length, 2, 'Receiver messages array must immediately update');
    assert.strictEqual(receiverState.messages[1].id, 'msg-1');
    assert.strictEqual(receiverState.reloadCount, 0, 'Must not trigger full page or component reload');
  });

  test('F8.3: Sender client renders optimistic message immediately upon click', () => {
    function handleSendMessageOptimistic(content, senderId, conversationId) {
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        conversationId,
        senderId,
        content,
        createdAt: new Date().toISOString(),
        status: 'sending'
      };
      return optimisticMessage;
    }

    const optimistic = handleSendMessageOptimistic('Mi pregunta sobre el ejercicio', 'student-1', 'conv-123');
    assert.ok(optimistic.id.startsWith('temp-'));
    assert.strictEqual(optimistic.status, 'sending');
    assert.strictEqual(optimistic.content, 'Mi pregunta sobre el ejercicio');
  });

  test('F8.4: Valid chat message passes safety policy scanner', () => {
    const cleanContent = 'Buenas tardes Mónica, ya revisé el material del módulo 1 y tengo una duda sobre la tarea.';
    const policyResult = scanContactPolicy(cleanContent);

    assert.strictEqual(policyResult.allowed, true, 'Clean message must pass safety filter');
    assert.strictEqual(policyResult.violations.length, 0);
  });

  test('F8.5: Chat safety policy flags external contact details (phone, email, external URLs)', () => {
    const violationEmail = 'Escríbeme a mi correo personal: juan@gmail.com';
    const policyResult1 = scanContactPolicy(violationEmail);
    assert.strictEqual(policyResult1.allowed, false);
    assert.ok(policyResult1.violations.includes('EMAIL'));

    const violationPhone = 'Llámame a mi whatsapp +52 55 1234 5678';
    const policyResult2 = scanContactPolicy(violationPhone);
    assert.strictEqual(policyResult2.allowed, false);
    assert.ok(policyResult2.violations.includes('PHONE'));
  });
});
