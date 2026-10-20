import test from "node:test";
import assert from "node:assert/strict";

import { isNetworkFailure, getRateLimitResult } from "./guardrails";

test("detecta fallos de red y offline en peticiones", () => {
  assert.equal(isNetworkFailure(new TypeError("Failed to fetch")), true);
  assert.equal(isNetworkFailure({ message: "Network request failed" }), true);
  assert.equal(isNetworkFailure(new Error("Validation failed")), false);
});

test("aplica rate limiting por usuario con ventana de tiempo", () => {
  const userId = "user-123";

  const first = getRateLimitResult(userId, "community-post", 2, 60_000);
  const second = getRateLimitResult(userId, "community-post", 2, 60_000);
  const third = getRateLimitResult(userId, "community-post", 2, 60_000);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterMs > 0);
});
