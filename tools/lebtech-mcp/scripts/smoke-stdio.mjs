// Stdio smoke: boots the built server under several gate configs and lists
// tools through a real MCP client. No app traffic — registration only,
// plus an optional live read when SMOKE_LIVE=true and the local stack is up.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "..", "dist", "index.js");

async function withServer(env, fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env, PORTAL_SESSION_SECRET: process.env.PORTAL_SESSION_SECRET ?? "smoke-secret", ...env },
  });
  const client = new Client({ name: "smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

const scenarios = [
  { label: "read-only (default)", env: {} },
  { label: "writes on", env: { MCP_WRITES_ENABLED: "true" } },
  {
    label: "everything on",
    env: {
      MCP_WRITES_ENABLED: "true",
      MCP_DESTRUCTIVE_ENABLED: "true",
      MCP_FRAPPE_TIER_ENABLED: "true",
      FRAPPE_API_KEY: process.env.FRAPPE_API_KEY ?? "smoke-key",
      FRAPPE_API_SECRET: process.env.FRAPPE_API_SECRET ?? "smoke-secret",
    },
  },
];

for (const { label, env } of scenarios) {
  await withServer(env, async (client) => {
    const { tools } = await client.listTools();
    const gates = { destructiveWithConfirm: 0 };
    for (const t of tools) if (t.inputSchema?.properties?.confirm) gates.destructiveWithConfirm++;
    console.log(`[${label}] tools=${tools.length} withConfirmParam=${gates.destructiveWithConfirm}`);
    const missingDesc = tools.filter((t) => !t.description || t.description.length < 20);
    if (missingDesc.length) throw new Error(`tools missing descriptions: ${missingDesc.map((t) => t.name)}`);
    if (label === "everything on" && process.env.SMOKE_LIVE === "true") {
      const health = await client.callTool({ name: "health_check", arguments: { probe: "live" } });
      console.log("  health_check(live):", health.content[0].text.replace(/\s+/g, " ").slice(0, 120));
      const leads = await client.callTool({ name: "leads_list", arguments: { pageSize: 2 } });
      console.log("  leads_list:", leads.content[0].text.replace(/\s+/g, " ").slice(0, 160));
    }
  });
}

// prod-refusal check: server must exit non-zero without MCP_PROD_CONFIRMED
import { spawnSync } from "node:child_process";
const prod = spawnSync(process.execPath, [serverPath], {
  env: { ...process.env, MCP_TARGET: "prod", PORTAL_SESSION_SECRET: "x" },
  encoding: "utf8",
  timeout: 15000,
});
if (prod.status === 1 && /MCP_PROD_CONFIRMED/.test(prod.stderr)) {
  console.log("[prod gate] server refused to start without MCP_PROD_CONFIRMED=true ✔");
} else {
  throw new Error(`prod gate failed: status=${prod.status} stderr=${prod.stderr}`);
}
console.log("SMOKE OK");
