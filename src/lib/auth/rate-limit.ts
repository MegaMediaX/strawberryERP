/**
 * Fixed-window in-memory rate limiter (dev/single-instance). Used to throttle
 * login attempts and blunt brute-force/credential-stuffing. In a multi-instance
 * production deployment this should be backed by Redis; the interface is the
 * same so the call sites do not change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, max: number, windowMs: number, now: number = Date.now()): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: max - bucket.count, retryAfterMs: 0 };
}

/** Clear a key's counter (e.g. after a successful login). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
