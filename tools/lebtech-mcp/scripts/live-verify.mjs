// Live verification against MCP_TARGET=local (acceptance step /verify):
//  - read tools return real data through the running portal + local Frappe
//  - a gated write flips a lead field and reverts it
//  - a destructive tool without confirm:true refuses
// Requires: portal dev server on :3000, local Docker Frappe on :8001.
// Env: PORTAL_SESSION_SECRET (defaults to the app's dev fallback),
//      FRAPPE_API_KEY/FRAPPE_API_SECRET for the frappe-tier checks.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "..", "dist", "index.js");
const DEV_FALLBACK_SECRET = "dev-only-insecure-session-secret-change-me";

const env = {
  ...process.env,
  MCP_TARGET: "local",
  PORTAL_SESSION_SECRET: process.env.PORTAL_SESSION_SECRET ?? DEV_FALLBACK_SECRET,
  MCP_WRITES_ENABLED: "true",
  MCP_DESTRUCTIVE_ENABLED: "true",
  ...(process.env.FRAPPE_API_KEY ? { MCP_FRAPPE_TIER_ENABLED: "true" } : {}),
};

const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], env });
const client = new Client({ name: "live-verify", version: "0.0.0" });
await client.connect(transport);

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  return JSON.parse(res.content[0].text);
};
const assert = (cond, label) => {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`ok: ${label}`);
};

try {
  const who = await call("portal_whoami");
  assert(who.ok === true && who.data?.user?.id, `portal_whoami authenticated as ${who.data?.user?.id} (${who.data?.user?.role})`);

  const health = await call("health_check", { probe: "live" });
  assert(health.ok === true, "health_check live");

  const leads = await call("leads_list", { pageSize: 3 });
  assert(leads.ok === true && Array.isArray(leads.data) && leads.data.length > 0, `leads_list returned ${leads.data?.length} rows (source=${leads.source}, total=${leads.total})`);

  // gated write: flip a lead's notes and revert
  const lead = leads.data[0];
  const leadId = lead.id ?? lead.name;
  const originalNotes = lead.notes ?? "";
  const marker = `mcp-verify ${new Date().toISOString()}`;
  const flip = await call("lead_update", { id: String(leadId), notes: marker });
  assert(flip.ok === true, `lead_update flipped notes on ${leadId} (source=${flip.source})`);
  const revert = await call("lead_update", { id: String(leadId), notes: originalNotes });
  assert(revert.ok === true, `lead_update reverted notes on ${leadId}`);

  // destructive without confirm must refuse
  const refusal = await call("admin_delete_queue_resolve", { id: "DQ-NONEXISTENT", action: "permanent" });
  assert(refusal.refused === true && refusal.code === "CONFIRMATION_REQUIRED", `destructive without confirm refused (${refusal.code})`);

  const reports = await call("report_run", { type: "conversion" });
  assert(reports.ok === true, "report_run conversion");

  if (env.MCP_FRAPPE_TIER_ENABLED === "true") {
    const ping = await call("frappe_ping");
    assert(ping.ok === true, `frappe_ping authenticated as ${ping.data}`);
    const fleads = await call("frappe_list_leads", { limit_page_length: 3 });
    assert(fleads.ok === true && Array.isArray(fleads.data), `frappe_list_leads returned ${fleads.data?.length} rows`);
  } else {
    console.log("skip: frappe tier (no FRAPPE_API_KEY in env)");
  }

  console.log("LIVE VERIFY OK");
} finally {
  await client.close();
}
