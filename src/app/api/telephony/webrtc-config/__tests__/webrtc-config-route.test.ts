import { afterEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET } from "@/app/api/telephony/webrtc-config/route";

function get(userId?: string) {
  return GET(
    new Request("https://portal.local/api/telephony/webrtc-config", {
      headers: userId ? { "x-platform-user-id": userId } : {},
    }),
  );
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

  it("DELETE is blocked (405)", () => {
    expect(DELETE().status).toBe(405);
  });
});
