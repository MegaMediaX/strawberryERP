import { createHmac, randomBytes } from "node:crypto";

/**
 * RFC 6238 TOTP (authenticator-app 2FA) using only node:crypto.
 *
 * - HOTP/TOTP per RFC 4226 / 6238 (SHA1, 30s step, 6 digits by default).
 * - Base32 (RFC 4648) for the shared secret + otpauth:// URL for QR enrollment.
 * - Verification allows a ±window step drift to tolerate clock skew.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a new base32 TOTP secret (default 20 random bytes = 160 bits). */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

function hotp(key: Buffer, counter: number, digits: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter (safe for values within Number range).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export interface TotpOptions {
  time?: number; // epoch seconds
  step?: number; // seconds
  t0?: number;
  digits?: number;
  key?: Buffer; // raw key override (used for RFC test vectors)
}

export function totp(secret: string, opts: TotpOptions = {}): string {
  const step = opts.step ?? 30;
  const t0 = opts.t0 ?? 0;
  const digits = opts.digits ?? 6;
  const time = opts.time ?? Math.floor(Date.now() / 1000);
  const key = opts.key ?? base32Decode(secret);
  const counter = Math.floor((time - t0) / step);
  return hotp(key, counter, digits);
}

/** Verify a code against the current window ±`window` steps (clock-skew tolerant). */
export function verifyTotp(secret: string, code: string, opts: TotpOptions & { window?: number } = {}): boolean {
  if (!code || !/^\d{4,8}$/.test(code)) return false;
  const window = opts.window ?? 1;
  const step = opts.step ?? 30;
  const time = opts.time ?? Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    if (totp(secret, { ...opts, time: time + i * step }) === code) {
      return true;
    }
  }
  return false;
}

/**
 * Login-time 2FA gate. Returns "ok" when 2FA is not enabled for the user
 * (no secret) or the code is valid; otherwise "required" / "invalid".
 */
export function loginTotpCheck(
  secret: string | undefined,
  code: string | undefined,
): "ok" | "required" | "invalid" {
  if (!secret) return "ok";
  if (!code) return "required";
  return verifyTotp(secret, code) ? "ok" : "invalid";
}

export function otpauthUrl(secret: string, accountName: string, issuer = "LebTech Partner Platform"): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
