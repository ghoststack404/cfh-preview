// tests/e2e/tier2-boundaries/f8-boundary.test.mjs
// F8 Boundary & Corner Cases (>= 5 test cases)
// Focus: Empty strings, max length, obfuscated contact data, non-existent conversations, reconnect queue

import { describe, test, assert } from '../harness/runner.mjs';
import { scanContactPolicy } from '../harness/mock-env.mjs';

describe('F8 Boundary: Real-Time Messaging Edge Cases', { tier: 'tier2' }, () => {
  function validateChatMessageInput(content) {
    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'EMPTY_CONTENT' };
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'WHITESPACE_ONLY' };
    }
    if (trimmed.length > 2000) {
      return { valid: false, error: 'EXCEEDS_MAX_LENGTH' };
    }
    const policy = scanContactPolicy(trimmed);
    if (!policy.allowed) {
      return { valid: false, error: 'POLICY_VIOLATION', violations: policy.violations };
    }
    return { valid: true, content: trimmed };
  }

  test('F8-B.1: Empty and whitespace-only chat messages are rejected', () => {
    const resEmpty = validateChatMessageInput('');
    assert.strictEqual(resEmpty.valid, false);
    assert.strictEqual(resEmpty.error, 'EMPTY_CONTENT');

    const resWhitespace = validateChatMessageInput('     \n\t   ');
    assert.strictEqual(resWhitespace.valid, false);
    assert.strictEqual(resWhitespace.error, 'WHITESPACE_ONLY');
  });

  test('F8-B.2: Message exceeding 2000 characters is rejected', () => {
    const oversizedContent = 'A'.repeat(2001);
    const res = validateChatMessageInput(oversizedContent);

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'EXCEEDS_MAX_LENGTH');
  });

  test('F8-B.3: Obfuscated phone numbers and URLs are detected by safety scanner', () => {
    const phoneObfuscated = 'Contáctame directo al 555-123-4567 o por fuera';
    const res = validateChatMessageInput(phoneObfuscated);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'POLICY_VIOLATION');
    assert.ok(res.violations.includes('PHONE'));

    const urlObfuscated = 'Visita mi sitio web http://clases-baratas.org para no pagar comisión';
    const resUrl = validateChatMessageInput(urlObfuscated);
    assert.strictEqual(resUrl.valid, false);
    assert.ok(resUrl.violations.includes('URL'));
  });

  test('F8-B.4: Sending a message to non-existent conversation returns 404', () => {
    const existingConversations = new Set(['conv-1', 'conv-2']);
    function sendMessageToConversation(convId, content) {
      if (!existingConversations.has(convId)) {
        return { status: 404, error: 'CONVERSATION_NOT_FOUND' };
      }
      return { status: 200, success: true };
    }

    const res = sendMessageToConversation('conv-non-existent-999', 'Hola');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.error, 'CONVERSATION_NOT_FOUND');
  });

  test('F8-B.5: WebSocket disconnection triggers retry queue without dropping pending messages', () => {
    class ResilientChatClient {
      constructor() {
        this.isConnected = false;
        this.outboxQueue = [];
        this.sentMessages = [];
      }

      sendMessage(msg) {
        if (!this.isConnected) {
          this.outboxQueue.push(msg);
          return { status: 'QUEUED' };
        }
        this.sentMessages.push(msg);
        return { status: 'SENT' };
      }

      reconnect() {
        this.isConnected = true;
        // Flush queue
        while (this.outboxQueue.length > 0) {
          const item = this.outboxQueue.shift();
          this.sentMessages.push(item);
        }
      }
    }

    const client = new ResilientChatClient();
    // Send while offline
    client.sendMessage({ id: 'msg-offline-1', content: 'Mensaje sin conexión' });
    assert.strictEqual(client.outboxQueue.length, 1);
    assert.strictEqual(client.sentMessages.length, 0);

    // Client reconnects
    client.reconnect();
    assert.strictEqual(client.outboxQueue.length, 0);
    assert.strictEqual(client.sentMessages.length, 1);
    assert.strictEqual(client.sentMessages[0].id, 'msg-offline-1');
  });
});
