import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildWebrtcConfig, mintTurnCredential, parseAgentMap } from "@/lib/telephony/webrtc";

describe("mintTurnCredential", () => {
  it("uses <now+ttl> as the username and base64 HMAC-SHA1(secret, username) as the credential", () => {
    const secret = "s3cret";
    const c = mintTurnCredential(secret, 3600, 1000);
    expect(c.username).toBe("4600"); // 1000 + 3600
    expect(c.credential).toBe(crypto.createHmac("sha1", secret).update("4600").digest("base64"));
  });

  it("is deterministic for the same inputs and moves with time", () => {
    expect(mintTurnCredential("s", 60, 100)).toEqual(mintTurnCredential("s", 60, 100));
    expect(mintTurnCredential("s", 60, 100).username).not.toBe(mintTurnCredential("s", 60, 200).username);
  });
});

describe("parseAgentMap", () => {
  it("keeps well-formed seats, drops junk", () => {
    const map = parseAgentMap('{"U1":{"user":"agent1","password":"p1"},"U2":{"user":"agent2"},"U3":"nope"}');
    expect(map).toEqual({ U1: { user: "agent1", password: "p1" } });
  });
  it("returns {} for undefined or malformed JSON", () => {
    expect(parseAgentMap(undefined)).toEqual({});
    expect(parseAgentMap("{not json")).toEqual({});
    expect(parseAgentMap("[]")).toEqual({});
  });
});

describe("buildWebrtcConfig", () => {
  const env = {
    wssUrl: "wss://voice.test/ws",
    sipDomain: "voice.test",
    turnUrl: "turn:voice.test:3478",
    turnSecret: "turnsecret",
    agentsJson: '{"USR-1":{"user":"agent1","password":"pw1"}}',
  };

  it("assembles the seat + ephemeral TURN creds for a mapped user", () => {
    const cfg = buildWebrtcConfig(env, "USR-1", 1000, 3600)!;
    expect(cfg.sipUri).toBe("sip:agent1@voice.test");
    expect(cfg.authUser).toBe("agent1");
    expect(cfg.password).toBe("pw1");
    expect(cfg.iceServers).toHaveLength(1);
    expect(cfg.iceServers[0]).toMatchObject({ urls: "turn:voice.test:3478", username: "4600" });
  });

  it("returns null when WebRTC is not configured", () => {
    expect(buildWebrtcConfig({ ...env, wssUrl: undefined }, "USR-1", 1000)).toBeNull();
    expect(buildWebrtcConfig({ ...env, sipDomain: undefined }, "USR-1", 1000)).toBeNull();
  });

  it("returns null when the user has no assigned seat", () => {
    expect(buildWebrtcConfig(env, "USR-UNKNOWN", 1000)).toBeNull();
  });

  it("omits TURN when no secret is set (STUN-less / host candidates only)", () => {
    const cfg = buildWebrtcConfig({ ...env, turnSecret: undefined }, "USR-1", 1000)!;
    expect(cfg.iceServers).toHaveLength(0);
  });
});
