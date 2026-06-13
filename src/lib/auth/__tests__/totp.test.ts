import { describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  loginTotpCheck,
  otpauthUrl,
  totp,
  verifyTotp,
} from "@/lib/auth/totp";

// RFC 6238 Appendix B test vectors (SHA1, 8 digits, T0=0, step=30, secret = ASCII "12345678901234567890").
const RFC_KEY = Buffer.from("12345678901234567890");
const RFC_VECTORS: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP — RFC 6238 published test vectors", () => {
  for (const [time, expected] of RFC_VECTORS) {
    it(`T=${time} -> ${expected}`, () => {
      expect(totp("", { key: RFC_KEY, time, digits: 8 })).toBe(expected);
    });
  }
});

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const buf = Buffer.from("hello totp world!!");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it("ignores padding/whitespace on decode", () => {
    const enc = base32Encode(Buffer.from("abc"));
    expect(base32Decode(`${enc}====`).equals(Buffer.from("abc"))).toBe(true);
  });
});

describe("generateTotpSecret", () => {
  it("produces a base32 secret of expected length", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(32); // 20 bytes -> 32 base32 chars
  });
});

describe("verifyTotp", () => {
  it("accepts the current code and tolerates ±1 step drift", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000;
    const code = totp(secret, { time: now });
    expect(verifyTotp(secret, code, { time: now })).toBe(true);
    expect(verifyTotp(secret, code, { time: now + 25 })).toBe(true); // next step, within window
    expect(verifyTotp(secret, code, { time: now - 25 })).toBe(true);
  });

  it("rejects a stale code outside the window", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000;
    const code = totp(secret, { time: now });
    expect(verifyTotp(secret, code, { time: now + 300 })).toBe(false);
  });

  it("rejects malformed codes", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "abcdef")).toBe(false);
    expect(verifyTotp(secret, "")).toBe(false);
    expect(verifyTotp(secret, "12")).toBe(false);
  });
});

describe("loginTotpCheck — login-time 2FA gate", () => {
  it("passes when 2FA is not enabled (no secret)", () => {
    expect(loginTotpCheck(undefined, undefined)).toBe("ok");
  });

  it("requires a code when a secret is set but none provided", () => {
    expect(loginTotpCheck(generateTotpSecret(), undefined)).toBe("required");
    expect(loginTotpCheck(generateTotpSecret(), "")).toBe("required");
  });

  it("accepts a valid current code and rejects a wrong one", () => {
    const secret = generateTotpSecret();
    const code = totp(secret);
    expect(loginTotpCheck(secret, code)).toBe("ok");
    expect(loginTotpCheck(secret, "000000")).toBe("invalid");
  });
});

describe("otpauthUrl", () => {
  it("builds a scannable otpauth URI with issuer and secret", () => {
    const url = otpauthUrl("ABCDEFGH", "super.admin@lebtech.example");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("secret=ABCDEFGH");
    expect(url).toContain("issuer=LebTech");
    expect(url).toContain("period=30");
  });
});
