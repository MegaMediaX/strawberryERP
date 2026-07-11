/**
 * Exhaustive wire-shape matrix: EVERY tool is invoked once with minimal valid
 * args against a mocked transport, asserting endpoint + HTTP method (and body
 * mapping where it is non-trivial). A tool added without a fixture fails the
 * suite — a typo'd path segment or wrong verb can never ship silently.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "undici";
import { loadConfig } from "../config.js";
import { PortalClient } from "../portal/client.js";
import { FrappeClient } from "../frappe/client.js";
import { invokeTool, type ToolContext } from "../registry.js";
import { allTools } from "../tools/index.js";

vi.mock("undici", () => ({ request: vi.fn() }));
const undiciMock = vi.mocked(request);

const config = loadConfig({
  PORTAL_SESSION_SECRET: "test-secret",
  MCP_WRITES_ENABLED: "true",
  MCP_DESTRUCTIVE_ENABLED: "true",
  MCP_FRAPPE_TIER_ENABLED: "true",
  FRAPPE_API_KEY: "k",
  FRAPPE_API_SECRET: "s",
} as NodeJS.ProcessEnv);
const ctx: ToolContext = { config, portal: new PortalClient(config), frappe: new FrappeClient(config) };

interface Fixture {
  args: Record<string, unknown>;
  /** Substring the request URL must contain (path + method mapping). */
  path: string;
  method: string;
  /** Exact JSON body expected (deep-equal), when the mapping is non-trivial. */
  body?: Record<string, unknown>;
}

const F = "lebtech_partner_platform.api";

const fixtures: Record<string, Fixture> = {
  // ── portal reads ───────────────────────────────────────────────────────
  portal_whoami: { args: {}, path: "/api/auth/session", method: "GET" },
  health_check: { args: { probe: "ready" }, path: "/api/health/ready", method: "GET" },
  leads_list: { args: { status: "New" }, path: "/api/frappe/leads?status=New", method: "GET" },
  customers_list: { args: {}, path: "/api/frappe/customers", method: "GET" },
  invoices_list: { args: {}, path: "/api/frappe/invoices", method: "GET" },
  invoice_get: { args: { id: "INV-1" }, path: "/api/frappe/invoices/INV-1", method: "GET" },
  receipts_list: { args: {}, path: "/api/frappe/receipts", method: "GET" },
  commissions_list: { args: { kind: "rules" }, path: "/api/frappe/commissions/rules", method: "GET" },
  report_run: { args: { type: "conversion" }, path: "/api/frappe/reports/conversion", method: "GET" },
  report_pnl: { args: {}, path: "/api/frappe/reports/pnl", method: "GET" },
  call_kpis: { args: { from: "2026-07-01" }, path: "/api/reports/call-kpis?from=2026-07-01", method: "GET" },
  audit_logs_list: { args: {}, path: "/api/frappe/audit-logs", method: "GET" },
  countries_list: { args: {}, path: "/api/admin/countries", method: "GET" },
  resellers_list: { args: {}, path: "/api/frappe/resellers", method: "GET" },
  contracts_list: { args: { customer: "C-1" }, path: "/api/frappe/contracts?customer=C-1", method: "GET" },
  delete_queue_list: { args: {}, path: "/api/frappe/delete-queue", method: "GET" },
  // ── portal writes ──────────────────────────────────────────────────────
  lead_create: {
    args: { companyName: "Acme", country: "Lebanon", assignedUser: "Elie Mouawad", phone: "03123456" },
    path: "/api/frappe/leads",
    method: "POST",
    body: { companyName: "Acme", country: "Lebanon", assignedUser: "Elie Mouawad", phone: "03123456" },
  },
  lead_update: { args: { id: "L-1", status: "Contacted" }, path: "/api/frappe/leads", method: "PATCH" },
  lead_import_simulate: {
    args: { records: [{ companyName: "A" }], duplicatePolicy: "skip" },
    path: "/api/frappe/leads/import",
    method: "POST",
    body: { records: [{ companyName: "A" }], duplicatePolicy: "skip" },
  },
  customer_create: { args: { payload: { country: "Lebanon" } }, path: "/api/frappe/customers", method: "POST", body: { country: "Lebanon" } },
  customer_update: { args: { payload: { id: "C-1", notes: "x" } }, path: "/api/frappe/customers", method: "PATCH", body: { id: "C-1", notes: "x" } },
  invoice_create: { args: { payload: { customer: "C-1" } }, path: "/api/frappe/invoices", method: "POST", body: { customer: "C-1" } },
  invoice_update: { args: { payload: { id: "I-1" } }, path: "/api/frappe/invoices", method: "PATCH", body: { id: "I-1" } },
  receipt_create: { args: { payload: { invoice: "I-1" } }, path: "/api/frappe/receipts", method: "POST", body: { invoice: "I-1" } },
  receipt_update: { args: { payload: { id: "R-1" } }, path: "/api/frappe/receipts", method: "PATCH", body: { id: "R-1" } },
  commission_entry_update: {
    args: { id: "CE-1", status: "Approved" },
    path: "/api/frappe/commissions/entries",
    method: "PATCH",
    body: { id: "CE-1", status: "Approved" },
  },
  admin_country_create: {
    args: { name: "Cyprus", currency: "EUR", timezone: "Asia/Nicosia", invoicePrefix: "CY" },
    path: "/api/admin/countries",
    method: "POST",
  },
  admin_country_update: { args: { payload: { name: "Cyprus", active: false } }, path: "/api/admin/countries", method: "PATCH", body: { name: "Cyprus", active: false } },
  admin_reseller_create: {
    args: {
      name: "R1",
      countries: ["Lebanon"],
      defaultCurrency: "USD",
      defaultCommissionPercentage: 10,
      defaultCommissionTrigger: "Fully Paid",
      visibility: "Assigned Countries",
    },
    path: "/api/admin/resellers",
    method: "POST",
  },
  admin_reseller_update: { args: { payload: { name: "R1", isActive: true } }, path: "/api/admin/resellers", method: "PATCH", body: { name: "R1", isActive: true } },
  admin_white_label_update: { args: { settings: { brandName: "X" } }, path: "/api/admin/white-label", method: "PATCH", body: { brandName: "X" } },
  admin_user_create: {
    args: { firstName: "A", lastName: "B", email: "a@b.co", role: "Sales Team User", password: "pw", countries: ["Lebanon"], reseller: "R1" },
    path: "/api/admin/users",
    method: "POST",
  },
  admin_user_update: { args: { id: "USR-1", action: "deactivate" }, path: "/api/admin/users/USR-1", method: "PATCH", body: { action: "deactivate" } },
  call_dial: { args: { number: "03123456", leadId: "L-1" }, path: "/api/calls/dial", method: "POST", body: { number: "03123456", leadId: "L-1" } },
  call_disposition: {
    args: { leadId: "L-1", disposition: "Interested" },
    path: "/api/calls/disposition",
    method: "POST",
    body: { leadId: "L-1", disposition: "Interested" },
  },
  // ── portal destructive (invoked WITH confirm:true; confirm must not leak into the body) ──
  admin_delete_request: {
    args: { entityType: "lead", entityId: "L-1", reason: "dupe", confirm: true },
    path: "/api/admin/delete-request",
    method: "POST",
    body: { entityType: "lead", entityId: "L-1", reason: "dupe" },
  },
  admin_delete_queue_resolve: {
    args: { id: "DQ-1", action: "restore", confirm: true },
    path: "/api/admin/delete-queue",
    method: "PATCH",
    body: { id: "DQ-1", action: "restore" },
  },
  admin_delete_queue_clear_all: {
    args: { confirmPhrase: "DELETE ALL", confirm: true },
    path: "/api/admin/delete-queue",
    method: "POST",
    // The gate's confirm:true boolean is remapped to the app's typed-phrase field.
    body: { action: "clear-all", confirm: "DELETE ALL" },
  },
  admin_commission_cancel: {
    args: { id: "CE-1", confirm: true },
    path: "/api/admin/commissions",
    method: "PATCH",
    body: { id: "CE-1", action: "cancel" },
  },
  // ── frappe reads ───────────────────────────────────────────────────────
  frappe_ping: { args: {}, path: "api/method/frappe.auth.get_logged_user", method: "GET" },
  frappe_list_leads: { args: {}, path: `api/method/${F}.leads.list_leads`, method: "GET" },
  frappe_list_customers: { args: {}, path: `api/method/${F}.customers.list_customers`, method: "GET" },
  frappe_list_calls: { args: {}, path: `api/method/${F}.calls.list_calls`, method: "GET" },
  frappe_list_invoices: { args: {}, path: `api/method/${F}.invoices.list_invoices`, method: "GET" },
  frappe_list_receipts: { args: {}, path: `api/method/${F}.receipts.list_receipts`, method: "GET" },
  frappe_list_commission_entries: { args: {}, path: `api/method/${F}.commissions.list_commission_entries`, method: "GET" },
  frappe_list_resellers: { args: {}, path: `api/method/${F}.operations.list_resellers`, method: "GET" },
  frappe_list_contracts: { args: {}, path: `api/method/${F}.operations.list_contracts`, method: "GET" },
  frappe_report: { args: { report: "pnl_summary" }, path: `api/method/${F}.reports.pnl_summary`, method: "GET" },
  frappe_white_label_get: { args: {}, path: `api/method/${F}.settings.get_white_label`, method: "GET" },
  frappe_integration_settings_list: { args: {}, path: `api/method/${F}.settings.list_integration_settings`, method: "GET" },
  frappe_api_keys_list: { args: {}, path: `api/method/${F}.api_keys.list_api_keys`, method: "GET" },
  frappe_delete_queue_list: { args: {}, path: `api/method/${F}.security.list_delete_queue`, method: "GET" },
  frappe_validate_csv: {
    args: { kind: "customer", csvText: "a,b" },
    path: `api/method/${F}.import_export.validate_customer_csv`,
    method: "POST",
    body: { csv_text: "a,b" },
  },
  frappe_export_records: { args: { doctype: "Partner Lead" }, path: `api/method/${F}.import_export.export_records?doctype=Partner+Lead`, method: "GET" },
  // ── frappe writes ──────────────────────────────────────────────────────
  frappe_create_lead: { args: { payload: { company_name: "A" } }, path: `${F}.leads.create_lead`, method: "POST", body: { company_name: "A" } },
  frappe_update_lead: { args: { name: "PL-1", payload: { status: "Contacted" } }, path: `${F}.leads.update_lead`, method: "POST", body: { name: "PL-1", status: "Contacted" } },
  frappe_convert_lead: { args: { lead_name: "PL-1" }, path: `${F}.leads.convert_to_customer`, method: "POST", body: { lead_name: "PL-1" } },
  frappe_create_customer: { args: { payload: { customer_name: "A" } }, path: `${F}.customers.create_customer`, method: "POST", body: { customer_name: "A" } },
  frappe_update_customer: { args: { name: "PC-1", payload: { notes: "x" } }, path: `${F}.customers.update_customer`, method: "POST", body: { name: "PC-1", notes: "x" } },
  frappe_upsert_call: { args: { payload: { external_id: "X-1" } }, path: `${F}.calls.upsert_call`, method: "POST", body: { external_id: "X-1" } },
  frappe_upsert_country: {
    args: { mode: "create", payload: { country_name: "Cyprus" } },
    path: `${F}.countries.create_country`,
    method: "POST",
    body: { country_name: "Cyprus" },
  },
  frappe_upsert_reseller: {
    args: { mode: "update", payload: { name: "R1" } },
    path: `${F}.operations.update_reseller`,
    method: "POST",
    body: { name: "R1" },
  },
  frappe_white_label_save: { args: { settings: { brandName: "X" } }, path: `${F}.settings.save_white_label`, method: "POST", body: { settings: { brandName: "X" } } },
  frappe_integration_setting_upsert: {
    args: { payload: { integration_type: "SMTP" } },
    path: `${F}.settings.upsert_integration_setting`,
    method: "POST",
    body: { integration_type: "SMTP" },
  },
  frappe_update_commission_entry_status: {
    args: { name: "CE-1", status: "Paid" },
    path: `${F}.commissions.update_commission_entry_status`,
    method: "POST",
    body: { name: "CE-1", status: "Paid" },
  },
  // ── frappe destructive (WITH confirm:true; confirm never forwarded) ────
  frappe_queue_delete: {
    args: { target_doctype: "Partner Lead", target_name: "PL-1", reason: "dupe", confirm: true },
    path: `${F}.security.queue_delete_request`,
    method: "POST",
    body: { target_doctype: "Partner Lead", target_name: "PL-1", reason: "dupe" },
  },
  frappe_resolve_delete_request: {
    args: { name: "DQ-1", status: "Restored", confirm: true },
    path: `${F}.security.resolve_delete_request`,
    method: "POST",
    body: { name: "DQ-1", status: "Restored" },
  },
  frappe_two_factor_remove: {
    args: { user: "user@example.com", confirm: true },
    path: `${F}.two_factor.remove`,
    method: "POST",
    body: { user: "user@example.com" },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  undiciMock.mockReset();
});

describe("wire matrix — every tool has a fixture", () => {
  it("no tool is missing a fixture (add one when adding a tool)", () => {
    const missing = allTools.map((t) => t.name).filter((name) => !fixtures[name]);
    expect(missing).toEqual([]);
    const stale = Object.keys(fixtures).filter((name) => !allTools.some((t) => t.name === name));
    expect(stale).toEqual([]);
  });

  for (const spec of allTools) {
    it(`${spec.name} → ${fixtures[spec.name]?.method ?? "?"} ${fixtures[spec.name]?.path ?? "?"}`, async () => {
      const fixture = fixtures[spec.name];
      expect(fixture, `fixture for ${spec.name}`).toBeDefined();

      let capturedUrl = "";
      let capturedMethod = "";
      let capturedBody: string | undefined;
      if (spec.tier === "portal") {
        const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => {
          capturedUrl = String(url);
          capturedMethod = init?.method ?? "GET";
          capturedBody = init?.body as string | undefined;
          return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
        });
        vi.stubGlobal("fetch", fetchMock);
      } else {
        undiciMock.mockImplementation((async (url: unknown, init: { method?: string; body?: string }) => {
          capturedUrl = String(url);
          capturedMethod = init?.method ?? "GET";
          capturedBody = init?.body;
          return { statusCode: 200, body: { text: async () => JSON.stringify({ message: {} }) } };
        }) as typeof request);
      }

      const result = await invokeTool(spec, structuredClone(fixture.args), ctx);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.refused, `${spec.name} unexpectedly refused: ${result.content[0].text}`).toBeUndefined();

      expect(capturedUrl, "endpoint").toContain(fixture.path);
      expect(capturedMethod, "http method").toBe(fixture.method);
      if (fixture.body !== undefined) {
        expect(JSON.parse(capturedBody ?? "null"), "body mapping").toEqual(fixture.body);
      }
      if (spec.gate === "destructive") {
        expect(parsed.action, "destructive action echo").toBeTypeOf("string");
        // the gate flag itself must never be forwarded as a boolean
        if (capturedBody) expect(JSON.parse(capturedBody).confirm).not.toBe(true);
      }
    });
  }
});
