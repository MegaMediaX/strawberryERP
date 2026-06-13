import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing using scrypt (no external dependency). Stored format is
 * `salt:hash` in hex. Verification is constant-time.
 */

const KEYLEN = 64;

export function hashPassword(password: string, salt: string = randomBytes(16).toString("hex")): string {
  const derived = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
