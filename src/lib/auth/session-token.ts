import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed session tokens (HMAC-SHA256). The token is
 * `base64url(payloadJson).base64url(signature)`. A forged or tampered token
 * fails verification because the signature depends on the server secret.
 *
 * The secret comes from PORTAL_SESSION_SECRET; a clearly-marked dev fallback is
 * used only when it is unset (never rely on it in production).
 */

const DEV_SECRET = "dev-only-insecure-session-secret-change-me";

function secret(): string {
  const configured = process.env.PORTAL_SESSION_SECRET;
  if (!configured) {
    // Never sign tokens with the public dev fallback in production — that would
    // let anyone forge a session. Fail closed (review #15).
    if (process.env.NODE_ENV === "production") {
      throw new Error("PORTAL_SESSION_SECRET must be set in production.");
    }
    return DEV_SECRET;
  }
  return configured;
}

export interface SessionPayload {
  sub: string; // portal user id
  exp: number; // expiry, epoch ms
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(sub: string, ttlMs = 12 * 60 * 60 * 1000): string {
  const payload: SessionPayload = { sub, exp: Date.now() + ttlMs };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  const expectedSig = sign(body);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "lebtech_session";
