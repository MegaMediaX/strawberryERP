import { describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to max within the window, then blocks", () => {
    const key = "unit:a";
    const max = 3;
    expect(checkRateLimit(key, max, 1000, 0).allowed).toBe(true); // 1
    expect(checkRateLimit(key, max, 1000, 0).allowed).toBe(true); // 2
    expect(checkRateLimit(key, max, 1000, 0).allowed).toBe(true); // 3
    const blocked = checkRateLimit(key, max, 1000, 0); // 4th
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = "unit:b";
    checkRateLimit(key, 1, 1000, 0);
    expect(checkRateLimit(key, 1, 1000, 500).allowed).toBe(false); // still in window
    expect(checkRateLimit(key, 1, 1000, 1500).allowed).toBe(true); // window passed
  });

  it("resetRateLimit clears the counter", () => {
    const key = "unit:c";
    checkRateLimit(key, 1, 1000, 0);
    expect(checkRateLimit(key, 1, 1000, 0).allowed).toBe(false);
    resetRateLimit(key);
    expect(checkRateLimit(key, 1, 1000, 0).allowed).toBe(true);
  });
});

function badLogin(email: string) {
  return login(
    new Request("https://portal.local/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify({ email, password: "definitely-wrong" }),
    }),
  );
}

describe("POST /api/auth/login — brute-force throttle", () => {
  it("returns 429 with Retry-After after too many attempts", async () => {
    const email = "brute-target@lebtech.example"; // unknown email, always 401 until throttled
    let sawRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const res = await badLogin(email);
      if (res.status === 429) {
        sawRateLimit = true;
        expect(res.headers.get("Retry-After")).toBeTruthy();
        break;
      }
      expect(res.status).toBe(401);
    }
    expect(sawRateLimit).toBe(true);
  });
});
