import { describe, expect, it } from "vitest";

import {
  checkRateLimit,
  computeIngestSignature,
  verifyIngestSignature,
  type RateLimitBucket,
} from "@/lib/telephony/ingest-auth";

const SECRET = "telephony-shared-secret";
const BODY = '{"external_id":"abc","outcome":"answered"}';
const NOW = 1_770_000_000_000; // fixed ms
const TS = String(Math.floor(NOW / 1000));

function sign(ts = TS, body = BODY, secret = SECRET) {
  return computeIngestSignature(secret, ts, body);
}

describe("verifyIngestSignature", () => {
  it("skips when no secret is configured (dev/unconfigured)", () => {
    const r = verifyIngestSignature({ rawBody: BODY, signature: null, timestamp: null, secret: undefined, nowMs: NOW });
    expect(r).toEqual({ ok: true, skipped: true });
  });

  it("accepts a correctly signed, fresh request", () => {
    const r = verifyIngestSignature({ rawBody: BODY, signature: sign(), timestamp: TS, secret: SECRET, nowMs: NOW });
    expect(r.ok).toBe(true);
  });

  it("rejects a missing signature/timestamp once a secret is set (fail closed)", () => {
    const r = verifyIngestSignature({ rawBody: BODY, signature: null, timestamp: null, secret: SECRET, nowMs: NOW });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a tampered body (signature mismatch)", () => {
    const r = verifyIngestSignature({
      rawBody: BODY + "x",
      signature: sign(),
      timestamp: TS,
      secret: SECRET,
      nowMs: NOW,
    });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a stale timestamp (replay window exceeded)", () => {
    const staleTs = String(Math.floor(NOW / 1000) - 3600);
    const r = verifyIngestSignature({
      rawBody: BODY,
      signature: sign(staleTs),
      timestamp: staleTs,
      secret: SECRET,
      nowMs: NOW,
    });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a signature made with the wrong secret", () => {
    const r = verifyIngestSignature({
      rawBody: BODY,
      signature: sign(TS, BODY, "wrong-secret"),
      timestamp: TS,
      secret: SECRET,
      nowMs: NOW,
    });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
});

describe("checkRateLimit", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const bucket: RateLimitBucket = new Map();
    const key = "ltp_calls_test";
    expect(checkRateLimit(bucket, key, 2, NOW).allowed).toBe(true);
    expect(checkRateLimit(bucket, key, 2, NOW).allowed).toBe(true);
    expect(checkRateLimit(bucket, key, 2, NOW).allowed).toBe(false);
  });

  it("resets in the next minute window", () => {
    const bucket: RateLimitBucket = new Map();
    const key = "k";
    expect(checkRateLimit(bucket, key, 1, NOW).allowed).toBe(true);
    expect(checkRateLimit(bucket, key, 1, NOW).allowed).toBe(false);
    expect(checkRateLimit(bucket, key, 1, NOW + 60_000).allowed).toBe(true);
  });

  it("treats a non-positive limit as unlimited", () => {
    const bucket: RateLimitBucket = new Map();
    expect(checkRateLimit(bucket, "k", 0, NOW).allowed).toBe(true);
  });
});
