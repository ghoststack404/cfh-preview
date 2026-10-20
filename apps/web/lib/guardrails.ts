const RATE_LIMIT_BUCKETS = new Map<string, { count: number; windowStart: number }>();

export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const value = error instanceof Error ? error.message : typeof error === "string" ? error : error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message) : "";
  const text = value.toLowerCase();

  if (!text) return false;

  return /failed to fetch|network request failed|network error|offline|connection.*(lost|failed)|timeout/.test(text) ||
    text.includes("typeerror");
}

export function getRateLimitResult(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
) {
  const key = `${action}:${userId}`;
  const now = Date.now();
  const existing = RATE_LIMIT_BUCKETS.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    const next = { count: 1, windowStart: now };
    RATE_LIMIT_BUCKETS.set(key, next);
    return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, limit - 1) };
  }

  const remaining = limit - existing.count;
  if (existing.count >= limit) {
    const retryAfterMs = Math.max(0, windowMs - (now - existing.windowStart));
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, remaining - 1) };
}
