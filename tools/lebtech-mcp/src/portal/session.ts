import { createHmac } from "node:crypto";

/**
 * Mint a lebtech_session token exactly as the app does
 * (src/lib/auth/session-token.ts): base64url(JSON{sub, exp}) + "." +
 * base64url(HMAC-SHA256(secret, body)). exp is epoch MILLISECONDS.
 * Seed passwords are placeholders that 401 — cookie minting is the supported
 * programmatic entry.
 */
export function mintSessionToken(
  secret: string,
  sub: string,
  ttlMs: number,
  now: number = Date.now(),
): string {
  const body = Buffer.from(JSON.stringify({ sub, exp: now + ttlMs }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export const SESSION_COOKIE = "lebtech_session";

export function sessionCookieHeader(secret: string, sub: string, ttlMs: number, now?: number): string {
  return `${SESSION_COOKIE}=${mintSessionToken(secret, sub, ttlMs, now)}`;
}
