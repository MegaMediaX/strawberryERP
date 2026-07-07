import { describe, expect, it } from "vitest";

import { authenticate } from "@/lib/auth/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";
import { SEED_ADMIN_PW } from "@/test/seed-credentials";

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
    const token = createSessionToken("USR-SALES-RAMI");
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

describe("authenticate (seed credentials)", () => {
  it("accepts the super admin credentials", () => {
    expect(authenticate("ggkhoueiry@gmail.com", SEED_ADMIN_PW)).toBe("USR-SUPER");
  });

  it("is case-insensitive on email and trims whitespace", () => {
    expect(authenticate("  GGKHOUEIRY@GMAIL.COM ", SEED_ADMIN_PW)).toBe("USR-SUPER");
  });

  it("rejects a wrong password", () => {
    expect(authenticate("ggkhoueiry@gmail.com", "nope")).toBeNull();
  });

  it("rejects an unknown email", () => {
    expect(authenticate("nobody@example.com", "whatever")).toBeNull();
  });
});
