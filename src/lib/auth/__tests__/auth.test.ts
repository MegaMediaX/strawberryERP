import { describe, expect, it } from "vitest";

import { authenticate } from "@/lib/auth/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";
import { SEED_ADMIN_PW } from "@/test/seed-credentials";
import { TEST_ONLY_SUPER_ADMIN_PW } from "@/test/test-credentials";

describe("passwords (scrypt)", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("produces a salted salt:hash format and rejects malformed stored values", () => {
    const stored = hashPassword("x");
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("session token (HMAC)", () => {
  it("signs and verifies a token", () => {
    const token = createSessionToken("USR-SUPER");
    expect(verifySessionToken(token)?.sub).toBe("USR-SUPER");
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken("USR-SALES-MARVEN");
    const [body, sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ sub: "USR-SUPER", exp: Date.now() + 100000 })).toString(
      "base64url",
    );
    expect(verifySessionToken(`${forgedBody}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken("USR-SUPER", -1000);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects empty/garbage tokens", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("no-dot")).toBeNull();
  });
});

// TI-3: these assertions need the REAL Super Admin secret (SEED_ADMIN_PW),
// which matches the prod-identical scrypt hash. On a fresh clone with no
// .env/.env.test/CI secret it is unset — skip cleanly instead of crashing.
describe.skipIf(!SEED_ADMIN_PW)("authenticate (seed credentials, real secret)", () => {
  if (!SEED_ADMIN_PW) {
    console.warn("[auth.test.ts] SEED_ADMIN_PW not set — skipping real-secret assertions. See docs/testing/auth-test-credentials.md.");
  }

  it("accepts the super admin credentials", () => {
    expect(authenticate("ggkhoueiry@gmail.com", SEED_ADMIN_PW as string)).toBe("USR-SUPER");
  });

  it("is case-insensitive on email and trims whitespace", () => {
    expect(authenticate("  GGKHOUEIRY@GMAIL.COM ", SEED_ADMIN_PW as string)).toBe("USR-SUPER");
  });
});

// TI-4: the committed, deterministic test-only fixture exercises the exact
// same authenticate() path with ZERO secrets configured, so this coverage
// never depends on SEED_ADMIN_PW being set.
describe("authenticate (seed credentials, test-only fixture)", () => {
  it("accepts the test-only super admin credentials", () => {
    expect(authenticate("ggkhoueiry@gmail.com", TEST_ONLY_SUPER_ADMIN_PW)).toBe("USR-SUPER");
  });

  it("is case-insensitive on email and trims whitespace", () => {
    expect(authenticate("  GGKHOUEIRY@GMAIL.COM ", TEST_ONLY_SUPER_ADMIN_PW)).toBe("USR-SUPER");
  });

  it("rejects a wrong password", () => {
    expect(authenticate("ggkhoueiry@gmail.com", "nope")).toBeNull();
  });

  it("rejects an unknown email", () => {
    expect(authenticate("nobody@example.com", "whatever")).toBeNull();
  });
});
