import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mintSessionToken, sessionCookieHeader, SESSION_COOKIE } from "../portal/session.js";

describe("mintSessionToken", () => {
  it("produces base64url(payload).base64url(hmac-sha256) matching the app's verifier contract", () => {
    const secret = "s3cret";
    const now = 1_750_000_000_000;
    const token = mintSessionToken(secret, "USR-SUPER", 3_600_000, now);
    const [body, sig] = token.split(".");
    // Signature recomputes over the base64url body
    const expected = createHmac("sha256", secret).update(body).digest("base64url");
    expect(sig).toBe(expected);
    // Payload is { sub, exp } with exp in epoch milliseconds
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    expect(payload).toEqual({ sub: "USR-SUPER", exp: now + 3_600_000 });
  });

  it("cookie header uses the lebtech_session cookie name", () => {
    const header = sessionCookieHeader("x", "USR-SALES-ELIE", 1000, 0);
    expect(header.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    expect(SESSION_COOKIE).toBe("lebtech_session");
  });
});
