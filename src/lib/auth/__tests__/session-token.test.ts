import { afterEach, describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

/**
 * COV-9: session-token.ts secret handling.
 * - Production fails closed when PORTAL_SESSION_SECRET is unset (review #15).
 * - A token signed under one secret is rejected once the secret rotates/differs.
 */
describe("session-token secret handling", () => {
  const originalSecret = process.env.PORTAL_SESSION_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PORTAL_SESSION_SECRET;
    else process.env.PORTAL_SESSION_SECRET = originalSecret;
    // @ts-expect-error - restore
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("throws when creating a token in production with no PORTAL_SESSION_SECRET set", () => {
    delete process.env.PORTAL_SESSION_SECRET;
    // @ts-expect-error - override for the test
    process.env.NODE_ENV = "production";
    expect(() => createSessionToken("USR-SUPER")).toThrow(/PORTAL_SESSION_SECRET must be set/);
  });

  it("throws when verifying in production with no PORTAL_SESSION_SECRET set", () => {
    // Sign a token outside production (dev fallback secret), then flip to
    // production for verification — the fail-closed guard must throw rather
    // than silently trust the token or fall back to the dev secret.
    delete process.env.PORTAL_SESSION_SECRET;
    const token = createSessionToken("USR-SUPER");
    // @ts-expect-error - override for the test
    process.env.NODE_ENV = "production";
    expect(() => verifySessionToken(token)).toThrow(/PORTAL_SESSION_SECRET must be set/);
  });

  it("does not throw outside production when PORTAL_SESSION_SECRET is unset (dev fallback)", () => {
    delete process.env.PORTAL_SESSION_SECRET;
    // @ts-expect-error - override for the test
    process.env.NODE_ENV = "test";
    const token = createSessionToken("USR-SUPER");
    expect(verifySessionToken(token)?.sub).toBe("USR-SUPER");
  });

  it("rejects a token signed under one secret once verified under a different (rotated) secret", () => {
    process.env.PORTAL_SESSION_SECRET = "secret-a-1234567890abcdef";
    const token = createSessionToken("USR-SUPER");
    expect(verifySessionToken(token)?.sub).toBe("USR-SUPER");

    process.env.PORTAL_SESSION_SECRET = "secret-b-different-9876543210";
    expect(verifySessionToken(token)).toBeNull();
  });

  it("accepts a token again once verified under its original secret (no accidental caching)", () => {
    process.env.PORTAL_SESSION_SECRET = "secret-a-1234567890abcdef";
    const token = createSessionToken("USR-SUPER");

    process.env.PORTAL_SESSION_SECRET = "secret-b-different-9876543210";
    expect(verifySessionToken(token)).toBeNull();

    process.env.PORTAL_SESSION_SECRET = "secret-a-1234567890abcdef";
    expect(verifySessionToken(token)?.sub).toBe("USR-SUPER");
  });
});
