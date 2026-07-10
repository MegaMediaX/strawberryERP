// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebrtcCallButton } from "@/components/platform/WebrtcCallButton";

/**
 * TC3 — WebrtcCallButton lifecycle (mocked fetch + mocked sip.js). PBX is
 * fully mocked: sip.js's `Web.SimpleUser` is a vi.mock'd class and
 * `fetch("/api/telephony/webrtc-config")` is stubbed per test. No network,
 * no real WebRTC/SIP registration ever happens.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockSimpleUserInstance = any;

const { simpleUserInstances } = vi.hoisted(() => {
  const instances: MockSimpleUserInstance[] = [];
  return { simpleUserInstances: instances };
});

vi.mock("sip.js", () => {
  class MockSimpleUser {
    wssUrl: string;
    options: unknown;
    connect = vi.fn(async () => {});
    disconnect = vi.fn(async () => {});
    register = vi.fn(async () => {});
    call = vi.fn(async () => {});
    hangup = vi.fn(async () => {});
    delegate?: unknown;
    constructor(wssUrl: string, options: unknown) {
      this.wssUrl = wssUrl;
      this.options = options;
      simpleUserInstances.push(this as never);
    }
  }
  return { Web: { SimpleUser: MockSimpleUser } };
});

const CONFIG = {
  wssUrl: "wss://voice.test/ws",
  sipUri: "sip:agent1@voice.test",
  authUser: "agent1",
  password: "pw1",
  sipDomain: "voice.test",
  iceServers: [],
};

function okConfigFetch() {
  return vi.fn(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ config: CONFIG }),
  })) as unknown as typeof fetch;
}

function notFoundFetch() {
  return vi.fn(async () => ({
    status: 404,
    ok: false,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}

function lastUser() {
  return simpleUserInstances[simpleUserInstances.length - 1];
}

beforeEach(() => {
  simpleUserInstances.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WebrtcCallButton — config fetch phases", () => {
  it("404 (no seat configured) → 'Phone not set up', disabled", async () => {
    vi.stubGlobal("fetch", notFoundFetch());
    render(<WebrtcCallButton number="+961 70 144 221" />);
    const btn = (await screen.findByRole("button", { name: "Phone not set up" })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("config ok → connects + registers the sip.js SimpleUser and becomes 'Call via browser', enabled", async () => {
    vi.stubGlobal("fetch", okConfigFetch());
    render(<WebrtcCallButton number="+961 70 144 221" />);
    const btn = (await screen.findByRole("button", { name: "Call via browser" })) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(lastUser().connect).toHaveBeenCalledTimes(1);
    expect(lastUser().register).toHaveBeenCalledTimes(1);
  });

  it("a thrown config fetch → error phase ('Phone unavailable'), no sip.js user constructed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(<WebrtcCallButton number="+961 70 144 221" />);
    const btn = (await screen.findByRole("button", { name: "Phone unavailable" })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(simpleUserInstances).toHaveLength(0);
  });
});

describe("WebrtcCallButton — dial guards short-circuit before user.call", () => {
  it("a blocked (+972) number shows the block message and never calls user.call", async () => {
    vi.stubGlobal("fetch", okConfigFetch());
    render(<WebrtcCallButton number="+972 50 123 4567" />);
    const btn = await screen.findByRole("button", { name: "Call via browser" });
    fireEvent.click(btn);
    await screen.findByText("Dialing this country is blocked.");
    expect(lastUser().call).not.toHaveBeenCalled();
  });

  it("a non-dialable number shows the 'no dialable number' guard and never calls user.call", async () => {
    vi.stubGlobal("fetch", okConfigFetch());
    render(<WebrtcCallButton number="+961" />);
    const btn = await screen.findByRole("button", { name: "Call via browser" });
    fireEvent.click(btn);
    await screen.findByText("This lead has no dialable number.");
    expect(lastUser().call).not.toHaveBeenCalled();
  });
});

describe("WebrtcCallButton — placing a call", () => {
  it("a Lebanese number builds sip:<local-digits>@<domain> via toLocalDialNumber and fires onCallStarted", async () => {
    vi.stubGlobal("fetch", okConfigFetch());
    const onCallStarted = vi.fn();
    render(<WebrtcCallButton number="+961 70 144 221" onCallStarted={onCallStarted} />);
    const btn = await screen.findByRole("button", { name: "Call via browser" });
    fireEvent.click(btn);
    await vi.waitFor(() => expect(lastUser().call).toHaveBeenCalledTimes(1));
    expect(lastUser().call).toHaveBeenCalledWith("sip:070144221@voice.test");
    expect(onCallStarted).toHaveBeenCalledTimes(1);
  });
});
