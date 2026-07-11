import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "undici";
import { loadConfig } from "../config.js";
import { PortalClient } from "../portal/client.js";
import { FrappeClient } from "../frappe/client.js";

vi.mock("undici", () => ({ request: vi.fn() }));
const requestMock = vi.mocked(request);

function undiciResponse(status: number, body: unknown) {
  return { statusCode: status, body: { text: async () => JSON.stringify(body) } } as Awaited<ReturnType<typeof request>>;
}

const cfg = loadConfig({
  PORTAL_SESSION_SECRET: "portal-secret",
  MCP_FRAPPE_TIER_ENABLED: "true",
  FRAPPE_API_KEY: "the-key",
  FRAPPE_API_SECRET: "the-secret",
} as NodeJS.ProcessEnv);

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  requestMock.mockReset();
});

describe("PortalClient", () => {
  it("sends a signed lebtech_session cookie and builds query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true, data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new PortalClient(cfg).request("/api/frappe/leads", {
      query: { page: 2, pageSize: 25, status: undefined },
    });
    expect(result).toEqual({ ok: true, data: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:3000/api/frappe/leads?page=2&pageSize=25");
    const cookie = (init.headers as Record<string, string>).cookie;
    expect(cookie).toMatch(/^lebtech_session=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(init.method).toBe("GET");
  });

  it("JSON-encodes bodies for writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await new PortalClient(cfg).request("/api/frappe/leads", { method: "POST", body: { companyName: "Acme" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ companyName: "Acme" }));
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("maps HTTP errors to structured failures without leaking secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: "PERMISSION_DENIED", message: "denied portal-secret" } }), {
        status: 403,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = (await new PortalClient(cfg).request("/api/admin/countries")) as Record<string, unknown>;
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.code).toBe("PERMISSION_DENIED");
    expect(String(result.message)).not.toContain("portal-secret");
    expect(String(result.message)).toContain("[redacted]");
  });

  it("maps network failures to CONNECTION_ERROR instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:3000")));
    const result = (await new PortalClient(cfg).request("/api/health")) as Record<string, unknown>;
    expect(result).toMatchObject({ ok: false, code: "CONNECTION_ERROR" });
  });
});

describe("FrappeClient (undici.request — fetch strips custom Host headers)", () => {
  it("uses token auth + Host header and query params for GET", async () => {
    requestMock.mockResolvedValue(undiciResponse(200, { message: [{ name: "L-0001" }] }));
    const result = (await new FrappeClient(cfg).call("lebtech_partner_platform.api.leads.list_leads", {
      params: { country: "Lebanon", limit_page_length: 5 },
    })) as Record<string, unknown>;
    expect(result).toEqual({ ok: true, data: [{ name: "L-0001" }] });
    const [url, init] = requestMock.mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:8001/api/method/lebtech_partner_platform.api.leads.list_leads?country=Lebanon&limit_page_length=5",
    );
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers.authorization).toBe("token the-key:the-secret");
    expect(headers.host).toBe("lebtech.local");
  });

  it("POSTs params as JSON body", async () => {
    requestMock.mockResolvedValue(undiciResponse(200, { message: { name: "L-0002" } }));
    await new FrappeClient(cfg).call("lebtech_partner_platform.api.leads.create_lead", {
      httpMethod: "POST",
      params: { company_name: "Acme", country: "Lebanon" },
    });
    const [, init] = requestMock.mock.calls[0];
    expect((init as { method: string }).method).toBe("POST");
    expect(JSON.parse((init as { body: string }).body)).toEqual({ company_name: "Acme", country: "Lebanon" });
  });

  it("keeps only the first line of a Frappe exception and redacts secrets", async () => {
    requestMock.mockResolvedValue(
      undiciResponse(417, { exception: "ValidationError: bad the-secret\nTraceback (most recent...)" }),
    );
    const result = (await new FrappeClient(cfg).call("x.y.z", { httpMethod: "POST" })) as Record<string, unknown>;
    expect(result.ok).toBe(false);
    expect(String(result.message)).not.toContain("Traceback");
    expect(String(result.message)).not.toContain("the-secret");
  });

  it("maps connection errors to CONNECTION_ERROR instead of throwing", async () => {
    requestMock.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8001"));
    const result = (await new FrappeClient(cfg).call("x.y.z")) as Record<string, unknown>;
    expect(result).toMatchObject({ ok: false, code: "CONNECTION_ERROR" });
  });
});
