import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { PortalClient } from "../portal/client.js";
import { FrappeClient } from "../frappe/client.js";
import { invokeTool, isRegistered, selectTools, type ToolContext } from "../registry.js";
import { allTools } from "../tools/index.js";

function makeConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    PORTAL_SESSION_SECRET: "test-secret",
    ...(overrides.MCP_FRAPPE_TIER_ENABLED === "true" ? { FRAPPE_API_KEY: "k", FRAPPE_API_SECRET: "s" } : {}),
    ...overrides,
  } as NodeJS.ProcessEnv);
}

function makeCtx(overrides: Record<string, string> = {}): ToolContext {
  const config = makeConfig(overrides);
  return { config, portal: new PortalClient(config), frappe: new FrappeClient(config) };
}

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

const byName = (name: string) => {
  const spec = allTools.find((t) => t.name === name);
  if (!spec) throw new Error(`missing tool ${name}`);
  return spec;
};

afterEach(() => vi.unstubAllGlobals());

describe("registration gate matrix (tier x writes x destructive)", () => {
  const cases: Array<{ env: Record<string, string>; expects: Record<string, boolean> }> = [
    // default: read-only portal
    { env: {}, expects: { leads_list: true, lead_create: false, admin_delete_request: false, frappe_list_leads: false } },
    // writes on
    {
      env: { MCP_WRITES_ENABLED: "true" },
      expects: { leads_list: true, lead_create: true, admin_delete_request: false, frappe_list_leads: false },
    },
    // destructive without writes stays OFF
    {
      env: { MCP_DESTRUCTIVE_ENABLED: "true" },
      expects: { lead_create: false, admin_delete_request: false },
    },
    // writes + destructive
    {
      env: { MCP_WRITES_ENABLED: "true", MCP_DESTRUCTIVE_ENABLED: "true" },
      expects: { lead_create: true, admin_delete_request: true, frappe_queue_delete: false },
    },
    // frappe tier read-only
    {
      env: { MCP_FRAPPE_TIER_ENABLED: "true" },
      expects: { frappe_list_leads: true, frappe_create_lead: false, frappe_resolve_delete_request: false },
    },
    // everything on
    {
      env: { MCP_FRAPPE_TIER_ENABLED: "true", MCP_WRITES_ENABLED: "true", MCP_DESTRUCTIVE_ENABLED: "true" },
      expects: {
        frappe_list_leads: true,
        frappe_create_lead: true,
        frappe_resolve_delete_request: true,
        admin_delete_queue_clear_all: true,
      },
    },
  ];

  for (const { env, expects } of cases) {
    it(`env ${JSON.stringify(env)}`, () => {
      const config = makeConfig(env);
      const names = new Set(selectTools(allTools, config).map((t) => t.name));
      for (const [tool, expected] of Object.entries(expects)) {
        expect(names.has(tool), `${tool} registered`).toBe(expected);
      }
    });
  }

  it("read tools are always registered for the portal tier", () => {
    const config = makeConfig();
    for (const spec of allTools.filter((t) => t.tier === "portal" && t.gate === "read")) {
      expect(isRegistered(spec, config), spec.name).toBe(true);
    }
  });
});

describe("runtime gate refusals (defense in depth — structured, never thrown)", () => {
  it("write tool with writes disabled returns a WRITES_DISABLED refusal", async () => {
    const result = await invokeTool(byName("lead_create"), { companyName: "A" }, makeCtx());
    const body = parse(result);
    expect(body).toMatchObject({ ok: false, refused: true, code: "WRITES_DISABLED" });
    expect(result.isError).toBeUndefined();
  });

  it("frappe tool with tier disabled returns FRAPPE_TIER_DISABLED", async () => {
    const body = parse(await invokeTool(byName("frappe_list_leads"), {}, makeCtx()));
    expect(body).toMatchObject({ ok: false, refused: true, code: "FRAPPE_TIER_DISABLED" });
  });

  it("destructive tool without MCP_DESTRUCTIVE_ENABLED refuses and echoes intent", async () => {
    const ctx = makeCtx({ MCP_WRITES_ENABLED: "true" });
    const body = parse(
      await invokeTool(byName("admin_delete_request"), { entityType: "lead", entityId: "L-1", reason: "dupe", confirm: true }, ctx),
    );
    expect(body.code).toBe("DESTRUCTIVE_DISABLED");
    expect(body.wouldHaveDone).toContain("L-1");
  });

  it("destructive tool without confirm:true refuses with CONFIRMATION_REQUIRED and echoes intent", async () => {
    const ctx = makeCtx({ MCP_WRITES_ENABLED: "true", MCP_DESTRUCTIVE_ENABLED: "true" });
    const body = parse(
      await invokeTool(byName("admin_delete_queue_resolve"), { id: "DQ-9", action: "permanent" }, ctx),
    );
    expect(body).toMatchObject({ ok: false, refused: true, code: "CONFIRMATION_REQUIRED" });
    expect(body.wouldHaveDone).toContain("DQ-9");
    expect(body.wouldHaveDone).toContain("permanent");
  });

  it("destructive tool with confirm:true proceeds and echoes the action in the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { resolved: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ctx = makeCtx({ MCP_WRITES_ENABLED: "true", MCP_DESTRUCTIVE_ENABLED: "true" });
    const body = parse(
      await invokeTool(byName("admin_delete_queue_resolve"), { id: "DQ-9", action: "restore", confirm: true }, ctx),
    );
    expect(body.action).toContain("DQ-9");
    expect(body.result).toMatchObject({ ok: true });
    // confirm flag is a gate parameter, never forwarded to the app
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body as string).not.toContain("confirm");
  });

  it("handler exceptions become structured TOOL_ERROR results, not throws", async () => {
    const spec = { ...byName("leads_list"), handler: async () => { throw new Error("boom"); } };
    const result = await invokeTool(spec, {}, makeCtx());
    expect(parse(result)).toMatchObject({ ok: false, code: "TOOL_ERROR", message: "boom" });
    expect(result.isError).toBe(true);
  });
});

describe("tool inventory hygiene", () => {
  it("tool names are unique and every tool has a description + schema", () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const spec of allTools) {
      expect(spec.description.length, spec.name).toBeGreaterThan(20);
      expect(spec.schema, spec.name).toBeDefined();
      expect(["portal", "frappe"]).toContain(spec.tier);
      expect(["read", "write", "destructive"]).toContain(spec.gate);
    }
  });

  it("every destructive tool declares a confirm param and an action echo", () => {
    for (const spec of allTools.filter((t) => t.gate === "destructive")) {
      expect(spec.schema.confirm, `${spec.name} confirm param`).toBeDefined();
      expect(spec.describeAction, `${spec.name} describeAction`).toBeTypeOf("function");
    }
  });
});
