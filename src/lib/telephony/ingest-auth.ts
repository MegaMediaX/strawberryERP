import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Middleware→CRM ingest hardening (ADR 0001, Phase 2).
 *
 * On top of the API-key scope check, the telephony middleware signs each POST
 * so a leaked/observed key alone cannot forge call logs, and stale requests are
 * rejected (replay protection). All pure + unit-tested; the route owns the
 * secret and the shared rate-limit bucket.
 */

export interface VerifyIngestOptions {
  /** Exact request body text the signature was computed over. */
  rawBody: string;
  /** Hex HMAC-SHA256 from the `X-Signature` header. */
  signature: string | null;
  /** `X-Timestamp` header — epoch seconds (string). */
  timestamp: string | null;
  /** Shared secret. When empty/undefined, verification is skipped (unconfigured). */
  secret: string | undefined;
  /** Current time in ms (injected for deterministic tests). */
  nowMs: number;
  /** Allowed clock skew in seconds. Default 300 (±5 min). */
  toleranceSec?: number;
}

export type VerifyResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; status: number; error: string };

/** HMAC-SHA256 hex of `${timestamp}.${rawBody}` — the canonical signing string. */
export function ingestSigningString(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function computeIngestSignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(ingestSigningString(timestamp, rawBody)).digest("hex");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify an ingest request's HMAC signature + timestamp freshness. Fails closed
 * once a secret is configured: a missing/short/stale/mismatched signature is a
 * 401. With no secret configured it returns { ok, skipped } (dev/unconfigured).
 */
export function verifyIngestSignature(opts: VerifyIngestOptions): VerifyResult {
  const { rawBody, signature, timestamp, secret, nowMs, toleranceSec = 300 } = opts;

  if (!secret) return { ok: true, skipped: true };

  if (!signature || !timestamp) {
    return { ok: false, status: 401, error: "Missing request signature or timestamp." };
  }

  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec)) {
    return { ok: false, status: 401, error: "Invalid timestamp." };
  }
  const skewSec = Math.abs(nowMs / 1000 - tsSec);
  if (skewSec > toleranceSec) {
    return { ok: false, status: 401, error: "Request timestamp is outside the allowed window." };
  }

  const expected = computeIngestSignature(secret, timestamp, rawBody);
  if (!timingSafeHexEqual(signature, expected)) {
    return { ok: false, status: 401, error: "Request signature verification failed." };
  }

  return { ok: true };
}

/** Fixed-window rate-limit state, keyed by `${apiKey}:${windowMinute}`. */
export type RateLimitBucket = Map<string, number>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Fixed-window per-key rate limit. `bucket` is injected so callers own the
 * lifetime (module-level in the route, fresh Map in tests). Returns remaining
 * budget in the current minute window.
 */
export function checkRateLimit(
  bucket: RateLimitBucket,
  key: string,
  limitPerMinute: number,
  nowMs: number,
): RateLimitResult {
  if (limitPerMinute <= 0) return { allowed: true, remaining: 0 };
  const windowKey = `${key}:${Math.floor(nowMs / 60_000)}`;
  const used = bucket.get(windowKey) ?? 0;
  if (used >= limitPerMinute) {
    return { allowed: false, remaining: 0 };
  }
  bucket.set(windowKey, used + 1);
  return { allowed: true, remaining: limitPerMinute - used - 1 };
}
