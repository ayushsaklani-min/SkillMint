/**
 * Minimal in-memory token-bucket rate limiter per IP.
 *
 * Defaults: 10 requests per 60-second window per IP.
 * Returns { allowed, retryAfter } — retryAfter is seconds until reset when blocked.
 *
 * Not a distributed limiter — fine for a single-node oracle. On restart, buckets reset.
 * On burst load across IPs, bounded cleanup keeps memory from growing unbounded.
 */

export function createRateLimiter({ limit = 10, windowMs = 60_000, maxBuckets = 10_000, now = Date.now } = {}) {
  const buckets = new Map();

  function cleanup(currentTime) {
    if (buckets.size <= maxBuckets) return;
    for (const [ip, b] of buckets) {
      if (currentTime > b.resetAt) buckets.delete(ip);
    }
  }

  function check(ip) {
    const t = now();
    const b = buckets.get(ip);
    if (!b || t > b.resetAt) {
      buckets.set(ip, { count: 1, resetAt: t + windowMs });
      cleanup(t);
      return { allowed: true, retryAfter: 0 };
    }
    if (b.count >= limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - t) / 1000)) };
    }
    b.count++;
    return { allowed: true, retryAfter: 0 };
  }

  return { check, _buckets: buckets };
}
