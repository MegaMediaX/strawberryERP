import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// frappeRequest (src/lib/frappe-client.ts) reads FRAPPE_* env vars at module
// load via readRuntimeValue, so — matching the existing idiom in
// src/lib/__tests__/runtime-health.test.ts — every scenario saves/restores
// the vars and re-imports the module with vi.resetModules(). This is the
// wire contract every 502 FRAPPE_CONNECTION_ERROR mapping and every
// frappeBackendClient.handle() call ultimately depends on, and it has no
// direct test today.

const FRAPPE_VARS = ["FRAPPE_BASE_URL", "FRAPPE_API_KEY", "FRAPPE_API_SECRET", "FRAPPE_HOST_HEADER"] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of FRAPPE_VARS) saved[key] = process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (const key of FRAPPE_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function loadClient() {
  return import("@/lib/frappe-client");
}

describe("frappeRequest wire contract", () => {
  it("sends 'token key:secret' Authorization when only apiKey/apiSecret are configured", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "mykey";
    process.env.FRAPPE_API_SECRET = "mysecret";
    delete process.env.FRAPPE_HOST_HEADER;

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await frappeRequest("/api/method/x");

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("token mykey:mysecret");
  });

  it("prefers a Bearer token over key:secret when options.token is passed", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "mykey";
    process.env.FRAPPE_API_SECRET = "mysecret";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await frappeRequest("/api/method/x", { token: "session-jwt" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer session-jwt");
  });

  it("adds a Host header only when FRAPPE_HOST_HEADER is configured", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "k";
    process.env.FRAPPE_API_SECRET = "s";
    process.env.FRAPPE_HOST_HEADER = "lebtech.local";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await frappeRequest("/api/method/x");

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Host).toBe("lebtech.local");
  });

  it("omits the Host header when FRAPPE_HOST_HEADER is unset", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "k";
    process.env.FRAPPE_API_SECRET = "s";
    delete process.env.FRAPPE_HOST_HEADER;

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await frappeRequest("/api/method/x");

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect("Host" in headers).toBe(false);
  });

  it("strips a trailing slash from FRAPPE_BASE_URL before concatenating the path", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal/";
    process.env.FRAPPE_API_KEY = "k";
    process.env.FRAPPE_API_SECRET = "s";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await frappeRequest("/api/method/x");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://frappe.internal/api/method/x");
  });

  it("always sends cache:'no-store'", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "k";
    process.env.FRAPPE_API_SECRET = "s";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await frappeRequest("/api/method/x");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("JSON-stringifies the body only when one is provided, and defaults method to GET", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "k";
    process.env.FRAPPE_API_SECRET = "s";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await frappeRequest("/api/method/x");
    const [, initNoBody] = fetchMock.mock.calls[0];
    expect(initNoBody.method).toBe("GET");
    expect(initNoBody.body).toBeUndefined();

    await frappeRequest("/api/method/y", { method: "POST", body: { a: 1 } });
    const [, initWithBody] = fetchMock.mock.calls[1];
    expect(initWithBody.method).toBe("POST");
    expect(initWithBody.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("throws Error(status+detail) on a non-2xx response instead of returning it", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "k";
    process.env.FRAPPE_API_SECRET = "s";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error: something broke",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await expect(frappeRequest("/api/method/x")).rejects.toThrow(
      /Frappe request failed \(500\): Internal Server Error: something broke/,
    );
  });

  it("throws before ever calling fetch when FRAPPE_BASE_URL is unset", async () => {
    delete process.env.FRAPPE_BASE_URL;
    delete process.env.FRAPPE_API_KEY;
    delete process.env.FRAPPE_API_SECRET;

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { frappeRequest } = await loadClient();
    await expect(frappeRequest("/api/method/x")).rejects.toThrow("FRAPPE_BASE_URL is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("isFrappeConfigured", () => {
  it("is true only when base URL, api key, AND api secret are all present", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "k";
    process.env.FRAPPE_API_SECRET = "s";
    const { isFrappeConfigured } = await loadClient();
    expect(isFrappeConfigured()).toBe(true);
  });

  it("is false when any one of the three is missing", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "k";
    delete process.env.FRAPPE_API_SECRET;
    const { isFrappeConfigured } = await loadClient();
    expect(isFrappeConfigured()).toBe(false);
  });
});
