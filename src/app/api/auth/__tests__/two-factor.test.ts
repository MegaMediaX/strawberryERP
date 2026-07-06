import { describe, expect, it } from "vitest";

import { POST as setup } from "@/app/api/auth/2fa/setup/route";
import { POST as activate } from "@/app/api/auth/2fa/activate/route";
import { POST as disable } from "@/app/api/auth/2fa/disable/route";
import { POST as login } from "@/app/api/auth/login/route";
import { totp } from "@/lib/auth/totp";
import { loginTwoFactorState } from "@/lib/auth/two-factor-store";
import { SEED_ADMIN_PW, SEED_SUPER_EMAIL } from "@/test/seed-credentials";

const SUPER = SEED_SUPER_EMAIL;
const PW = SEED_ADMIN_PW;

function authed(handler: (r: Request) => Promise<Response>, userId: string, body?: unknown) {
  return handler(
    new Request("https://portal.local/api/auth/2fa/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-platform-user-id": userId },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function loginReq(body: unknown) {
  return login(
    new Request("https://portal.local/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("2FA enrollment endpoints require a session", () => {
  it("setup returns 401 without a session", async () => {
    const res = await setup(new Request("https://portal.local/api/auth/2fa/setup", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

describe("2FA enrollment → enforced login → disable (full flow)", () => {
  it("walks the whole lifecycle for the Super Admin", async () => {
    // Pre-condition: no 2FA, password-only login works.
    expect(await loginTwoFactorState("USR-SUPER", undefined)).toBe("ok");
    expect((await loginReq({ email: SUPER, password: PW })).status).toBe(200);

    // 1. setup -> get a secret + otpauth URL.
    const setupRes = await authed(setup, "USR-SUPER");
    expect(setupRes.status).toBe(200);
    const { data } = (await setupRes.json()) as { data: { secret: string; otpauthUrl: string } };
    expect(data.secret).toMatch(/^[A-Z2-7]+$/);
    expect(data.otpauthUrl).toContain("otpauth://totp/");

    // 2. activate with a wrong code -> 400, still not enabled.
    expect((await authed(activate, "USR-SUPER", { code: "000000" })).status).toBe(400);
    expect(await loginTwoFactorState("USR-SUPER", undefined)).toBe("ok");

    // 3. activate with a valid code -> enabled.
    const code = totp(data.secret);
    expect((await authed(activate, "USR-SUPER", { code })).status).toBe(200);
    expect(await loginTwoFactorState("USR-SUPER", undefined)).toBe("required");

    // 4. login now requires the second factor.
    expect((await loginReq({ email: SUPER, password: PW })).status).toBe(401); // TOTP_REQUIRED
    const loginRes = await loginReq({ email: SUPER, password: PW, totp: totp(data.secret) });
    expect(loginRes.status).toBe(200);

    // 5. SEC-6 step-up: disabling requires a current code. Without one → 400, still enabled.
    expect((await authed(disable, "USR-SUPER")).status).toBe(400);
    expect(await loginTwoFactorState("USR-SUPER", undefined)).toBe("required");
    // A wrong code → 400, still enabled (a hijacked session cannot strip 2FA).
    expect((await authed(disable, "USR-SUPER", { code: "000000" })).status).toBe(400);
    expect(await loginTwoFactorState("USR-SUPER", undefined)).toBe("required");
    // A valid current code → 200, back to password-only.
    expect((await authed(disable, "USR-SUPER", { code: totp(data.secret) })).status).toBe(200);
    expect(await loginTwoFactorState("USR-SUPER", undefined)).toBe("ok");
    expect((await loginReq({ email: SUPER, password: PW })).status).toBe(200);
  });
});
