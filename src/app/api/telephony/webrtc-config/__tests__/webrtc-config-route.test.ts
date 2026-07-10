import { afterEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET } from "@/app/api/telephony/webrtc-config/route";

function get(userId?: string) {
  return GET(
    new Request("https://portal.local/api/telephony/webrtc-config", {
      headers: userId ? { "x-platform-user-id": userId } : {},
    }),
  );
}

function getWithHeaders(headers: Record<string, string>) {
  return GET(new Request("https://portal.local/api/telephony/webrtc-config", { headers }));
}

function configureEnv(agents: string) {
  vi.stubEnv("WEBRTC_WSS_URL", "wss://voice.test/ws");
  vi.stubEnv("WEBRTC_SIP_DOMAIN", "voice.test");
  vi.stubEnv("WEBRTC_TURN_URL", "turn:voice.test:3478");
  vi.stubEnv("WEBRTC_TURN_SECRET", "turnsecret");
  vi.stubEnv("WEBRTC_AGENTS", agents);
}

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/telephony/webrtc-config", () => {
  it("returns the seat + minted TURN creds for a mapped, authenticated user", async () => {
    configureEnv('{"USR-SUPER":{"user":"agent1","password":"pw1"}}');
    const res = await get("USR-SUPER");
    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.sipUri).toBe("sip:agent1@voice.test");
    expect(config.authUser).toBe("agent1");
    expect(config.iceServers[0].urls).toBe("turn:voice.test:3478");
    expect(config.iceServers[0].credential).toBeTruthy();
  });

  it("404s when the user has no telephony seat", async () => {
    configureEnv("{}");
    expect((await get("USR-SUPER")).status).toBe(404);
  });

  // TC6 — previously-untested security branches: 401 unauthenticated, 403
  // impersonated, and the Cache-Control: no-store header that protects the
  // SIP password + TURN credentials the body carries.
  it("401s an unauthenticated caller (unknown/inactive user id resolves to ANONYMOUS_USER)", async () => {
    configureEnv('{"USR-SUPER":{"user":"agent1","password":"pw1"}}');
    const res = await get("USR-DOES-NOT-EXIST");
    expect(res.status).toBe(401);
  });

  it("403s a Super Admin session that is actively impersonating another user (route.ts line 18)", async () => {
    configureEnv('{"USR-SUPER":{"user":"agent1","password":"pw1"}}');
    const res = await getWithHeaders({
      "x-platform-user-id": "USR-SUPER",
      "x-platform-impersonate-user-id": "USR-SALES-MARVEN",
    });
    expect(res.status).toBe(403);
  });

  it("sets Cache-Control: no-store on the 200 response (never caches the SIP password / TURN creds)", async () => {
    configureEnv('{"USR-SUPER":{"user":"agent1","password":"pw1"}}');
    const res = await get("USR-SUPER");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("TURN credentials mint fresh (move) with the injected clock — two calls a tick apart differ", async () => {
    configureEnv('{"USR-SUPER":{"user":"agent1","password":"pw1"}}');
    const first = await (await get("USR-SUPER")).json();
    // buildWebrtcConfig mints off Date.now()/1000 with an hour TTL — mock the
    // clock forward so the minted TURN username (now+ttl) differs.
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 5000;
      const second = await (await get("USR-SUPER")).json();
      expect(second.config.iceServers[0].username).not.toBe(first.config.iceServers[0].username);
    } finally {
      Date.now = realNow;
    }
  });

  it("DELETE is blocked (405)", () => {
    expect(DELETE().status).toBe(405);
  });
});
