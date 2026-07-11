import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "undici";
import { loadConfig } from "../config.js";

vi.mock("undici", () => ({ request: vi.fn() }));
const requestMock = vi.mocked(request);

function stubUndici(body: unknown = { message: [] }) {
  requestMock.mockResolvedValue({
    statusCode: 200,
    body: { text: async () => JSON.stringify(body) },
  } as Awaited<ReturnType<typeof request>>);
  return requestMock;
}
import { PortalClient } from "../portal/client.js";
import { FrappeClient } from "../frappe/client.js";
import { invokeTool, type ToolContext } from "../registry.js";
import { allTools } from "../tools/index.js";

const config = loadConfig({
  PORTAL_SESSION_SECRET: "test-secret",
  MCP_WRITES_ENABLED: "true",
  MCP_DESTRUCTIVE_ENABLED: "true",
  MCP_FRAPPE_TIER_ENABLED: "true",
  FRAPPE_API_KEY: "k",
  FRAPPE_API_SECRET: "s",
} as NodeJS.ProcessEnv);
const ctx: ToolContext = { config, portal: new PortalClient(config), frappe: new FrappeClient(config) };
const byName = (name: string) => allTools.find((t) => t.name === name)!;

function stubFetch(body: unknown = { ok: true, data: [] }) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  requestMock.mockReset();
});

describe("portal tool wire shapes", () => {
  it("leads_list hits GET /api/frappe/leads with filters + pagination", async () => {
    const fetchMock = stubFetch();
    await invokeTool(byName("leads_list"), { page: 1, pageSize: 10, status: "New", country: "Lebanon" }, ctx);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/frappe/leads?");
    expect(url).toContain("status=New");
    expect(url).toContain("country=Lebanon");
    expect(url).toContain("pageSize=10");
  });

  it("lead_update PATCHes /api/frappe/leads with the id in the body", async () => {
    const fetchMock = stubFetch();
    await invokeTool(byName("lead_update"), { id: "L-7", status: "Contacted" }, ctx);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/frappe/leads");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toMatchObject({ id: "L-7", status: "Contacted" });
  });

  it("report_run routes to /api/frappe/reports/<type>", async () => {
    const fetchMock = stubFetch();
    await invokeTool(byName("report_run"), { type: "revenue", country: "Lebanon" }, ctx);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/frappe/reports/revenue?country=Lebanon");
  });

  it("commissions_list kind=entries routes to the entries collection", async () => {
    const fetchMock = stubFetch();
    await invokeTool(byName("commissions_list"), { kind: "entries" }, ctx);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/frappe/commissions/entries");
  });

  it("admin_user_update PATCHes /api/admin/users/<id> without the id in the body", async () => {
    const fetchMock = stubFetch();
    await invokeTool(byName("admin_user_update"), { id: "USR-SALES-ELIE", action: "deactivate" }, ctx);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/admin/users/USR-SALES-ELIE");
    expect(JSON.parse(init.body as string)).toEqual({ action: "deactivate" });
  });
});

describe("frappe tool wire shapes", () => {
  it("frappe_report maps catalog to report_catalog", async () => {
    const mock = stubUndici({ message: [] });
    await invokeTool(byName("frappe_report"), { report: "catalog" }, ctx);
    expect(String(mock.mock.calls[0][0])).toContain("api/method/lebtech_partner_platform.api.reports.report_catalog");
  });

  it("frappe_update_lead POSTs name + payload fields", async () => {
    const mock = stubUndici({ message: {} });
    await invokeTool(byName("frappe_update_lead"), { name: "PL-001", payload: { status: "Contacted" } }, ctx);
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain("leads.update_lead");
    expect(JSON.parse((init as { body: string }).body)).toEqual({ name: "PL-001", status: "Contacted" });
  });

  it("frappe_validate_csv POSTs csv_text to the right validator", async () => {
    const mock = stubUndici({ message: { accepted: [], warnings: [] } });
    await invokeTool(byName("frappe_validate_csv"), { kind: "lead", csvText: "a,b" }, ctx);
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain("import_export.validate_lead_csv");
    expect(JSON.parse((init as { body: string }).body)).toEqual({ csv_text: "a,b" });
  });

  it("frappe_queue_delete with confirm forwards only the frappe params", async () => {
    const mock = stubUndici({ message: { name: "DQ-1" } });
    await invokeTool(
      byName("frappe_queue_delete"),
      { target_doctype: "Partner Lead", target_name: "PL-9", reason: "dupe", confirm: true },
      ctx,
    );
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain("security.queue_delete_request");
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      target_doctype: "Partner Lead",
      target_name: "PL-9",
      reason: "dupe",
    });
  });
});
