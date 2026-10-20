/**
 * Coaching From Home - QA Test Runner Common Utilities
 * 
 * Provides assertions, color formatting, test suite runners, and
 * simulation helpers for HTTP, Middleware, Auth, and Database locks.
 */

import { strict as assert } from "node:assert";
import crypto from "node:crypto";

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

export class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.durationMs = 0;
    this.errors = [];
  }

  test(description, fn) {
    this.tests.push({ description, fn, isAsync: fn.constructor.name === "AsyncFunction" });
  }

  async run() {
    console.log(`\n${colors.bold}${colors.cyan}=== [SUITE] ${this.name} ===${colors.reset}`);
    const startTotal = Date.now();

    for (const t of this.tests) {
      const start = Date.now();
      try {
        await t.fn();
        const duration = Date.now() - start;
        this.passed++;
        console.log(`  ${colors.green}✔ PASS${colors.reset} ${t.description} ${colors.gray}(${duration}ms)${colors.reset}`);
      } catch (err) {
        const duration = Date.now() - start;
        this.failed++;
        this.errors.push({ test: t.description, error: err });
        console.log(`  ${colors.red}✖ FAIL${colors.reset} ${t.description} ${colors.gray}(${duration}ms)${colors.reset}`);
        console.log(`     ${colors.red}Error: ${err.message}${colors.reset}`);
        if (err.stack) {
          const firstStack = err.stack.split("\n").slice(1, 4).join("\n     ");
          console.log(`     ${colors.dim}${firstStack}${colors.reset}`);
        }
      }
    }

    this.durationMs = Date.now() - startTotal;
    const color = this.failed === 0 ? colors.green : colors.red;
    console.log(
      `${color}Result: ${this.passed} passed, ${this.failed} failed, ${this.tests.length} total (${this.durationMs}ms)${colors.reset}\n`
    );

    return {
      name: this.name,
      passed: this.passed,
      failed: this.failed,
      total: this.tests.length,
      durationMs: this.durationMs,
      errors: this.errors,
    };
  }
}

/**
 * Custom Matchers and Assertions
 */
export const expect = (actual) => ({
  toBe(expected) {
    assert.strictEqual(actual, expected, `Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
  },
  toEqual(expected) {
    assert.deepStrictEqual(actual, expected, `Expected deep equality between objects`);
  },
  toBeGreaterThan(expected) {
    assert.ok(actual > expected, `Expected ${actual} > ${expected}`);
  },
  toBeGreaterThanOrEqual(expected) {
    assert.ok(actual >= expected, `Expected ${actual} >= ${expected}`);
  },
  toBeLessThan(expected) {
    assert.ok(actual < expected, `Expected ${actual} < ${expected}`);
  },
  toBeLessThanOrEqual(expected) {
    assert.ok(actual <= expected, `Expected ${actual} <= ${expected}`);
  },
  toContain(item) {
    if (typeof actual === "string") {
      assert.ok(actual.includes(item), `Expected string "${actual}" to contain "${item}"`);
    } else if (Array.isArray(actual)) {
      assert.ok(actual.includes(item), `Expected array to contain item`);
    } else {
      throw new Error(`Unsupported type for toContain: ${typeof actual}`);
    }
  },
  toMatch(regex) {
    assert.ok(regex.test(actual), `Expected "${actual}" to match ${regex}`);
  },
  toBeDefined() {
    assert.ok(actual !== undefined, `Expected value to be defined`);
  },
  toBeNull() {
    assert.strictEqual(actual, null, `Expected value to be null`);
  },
  toBeTruthy() {
    assert.ok(Boolean(actual), `Expected truthy value`);
  },
  toBeFalsy() {
    assert.ok(!actual, `Expected falsy value`);
  },
});

/**
 * Signed URL Generator & Verifier (HMAC-SHA256)
 * Reflects interface contract in PROJECT.md F10 / S3 Signed URL Contract
 */
export function generateSignedDownloadUrl({
  fileId,
  userId,
  expiresInSeconds = 300,
  secret = "cfh-s3-qa-test-secret-key-2026",
  baseUrl = "https://app.coachingfromhome.com/api/course-files",
}) {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);
  const payload = `${fileId}:${userId}:${expiryTimestamp}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const downloadUrl = `${baseUrl}/${fileId}?token=${signature}&expires=${expiryTimestamp}&u=${userId}`;
  return { downloadUrl, expiresAt, token: signature, expires: expiryTimestamp };
}

export function verifySignedDownloadToken({
  fileId,
  userId,
  token,
  expires,
  secret = "cfh-s3-qa-test-secret-key-2026",
}) {
  if (!token || !expires || !userId) {
    return { valid: false, reason: "MISSING_PARAMETERS", status: 401 };
  }

  const nowTimestamp = Math.floor(Date.now() / 1000);
  const exp = parseInt(expires, 10);
  if (isNaN(exp) || nowTimestamp > exp) {
    return { valid: false, reason: "TOKEN_EXPIRED", status: 403 };
  }

  const payload = `${fileId}:${userId}:${exp}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const valid = crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expectedSig, "hex"));
    if (!valid) {
      return { valid: false, reason: "INVALID_SIGNATURE", status: 403 };
    }
    return { valid: true, status: 200 };
  } catch {
    return { valid: false, reason: "INVALID_SIGNATURE_FORMAT", status: 403 };
  }
}

/**
 * Atomic Concurrency Simulator for Row Locks
 * Models MySQL SELECT ... FOR UPDATE / transaction serialization semantics
 */
export class ConcurrencyLockHarness {
  constructor() {
    this.bookedSlots = new Map(); // key: `${coachId}:${slotIso}`, value: bookingRecord
    this.activeLocks = new Set();  // key: `${coachId}:${slotIso}`
  }

  async bookSlotWithLock({ studentId, coachId, startAt, durationMinutes = 60, priceCents = 5000 }) {
    const slotKey = `${coachId}:${new Date(startAt).toISOString()}`;

    // Transaction begin with Row-Lock acquisition
    // If another transaction currently holds the lock for this row/slot, wait or encounter conflict
    if (this.activeLocks.has(slotKey)) {
      // Row is currently locked by concurrent transaction
      return {
        status: 409,
        success: false,
        code: "SLOT_CONFLICT",
        error: "Este horario ya fue reservado o está en proceso de reserva.",
      };
    }

    // Acquire lock
    this.activeLocks.add(slotKey);

    try {
      // Simulate microscopic I/O / DB latency during transaction
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 15 + 5));

      // Verify slot existence
      if (this.bookedSlots.has(slotKey)) {
        return {
          status: 409,
          success: false,
          code: "SLOT_CONFLICT",
          error: "Ese horario ya no está disponible.",
        };
      }

      // Create booking
      const booking = {
        id: `bk_${crypto.randomUUID()}`,
        studentId,
        coachId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString(),
        priceCents,
        status: "CONFIRMED",
        createdAt: new Date().toISOString(),
      };

      this.bookedSlots.set(slotKey, booking);
      return { status: 201, success: true, booking };
    } finally {
      // Release lock on commit or rollback
      this.activeLocks.delete(slotKey);
    }
  }
}
