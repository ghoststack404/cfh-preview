// tests/e2e/harness/contracts.mjs
// Contract validation assertions based on PROJECT.md § Interface Contracts

import assert from 'node:assert';

export function assertValidMessageSchema(msg) {
  assert.ok(msg, 'Message object must exist');
  assert.strictEqual(typeof msg.id, 'string', 'Message.id must be string');
  assert.strictEqual(typeof msg.conversationId, 'string', 'Message.conversationId must be string');
  assert.strictEqual(typeof msg.senderId, 'string', 'Message.senderId must be string');
  assert.strictEqual(typeof msg.content, 'string', 'Message.content must be string');
  assert.ok(msg.createdAt, 'Message.createdAt must exist');
}

export function assertValidPresenceMember(member) {
  assert.ok(member, 'Member object must exist');
  assert.strictEqual(typeof member.id, 'string', 'Member.id must be string');
  assert.strictEqual(typeof member.name, 'string', 'Member.name must be string');
  assert.ok(['COACH', 'STUDENT', 'APPRENTICE', 'ADMIN'].includes(member.role), `Invalid member role: ${member.role}`);
}

export function assertValidFreeBooking(booking) {
  assert.ok(booking, 'Booking object must exist');
  assert.strictEqual(booking.durationMinutes, 15, 'Free intro booking duration must be strictly 15 minutes');
  assert.strictEqual(booking.price, 0, 'Free intro booking price must be strictly $0.00');
  assert.strictEqual(booking.type, 'FREE_INTRO', 'Booking type must be FREE_INTRO');
  assert.strictEqual(booking.status, 'CONFIRMED', 'Booking status must be CONFIRMED');
}

export function assertValidProgressToggleResponse(res) {
  assert.ok(res, 'Response object must exist');
  assert.strictEqual(typeof res.success, 'boolean', 'Response.success must be boolean');
  assert.strictEqual(typeof res.completed, 'boolean', 'Response.completed must be boolean');
}
