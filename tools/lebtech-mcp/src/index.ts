#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, ConfigError, type McpConfig } from "./config.js";
import { PortalClient } from "./portal/client.js";
import { FrappeClient } from "./frappe/client.js";
import { allTools } from "./tools/index.js";
import { invokeTool, selectTools, type ToolContext } from "./registry.js";

export function buildServer(config: McpConfig): { server: McpServer; registeredNames: string[] } {
  const ctx: ToolContext = {
    config,
    portal: new PortalClient(config),
    frappe: new FrappeClient(config),
  };
  const server = new McpServer({ name: "lebtech-mcp", version: "0.1.0" });
  const registered = selectTools(allTools, config);
  for (const spec of registered) {
    server.registerTool(
      spec.name,
      { description: spec.description, inputSchema: spec.schema },
      async (args: Record<string, unknown>) => invokeTool(spec, args ?? {}, ctx),
    );
  }
  return { server, registeredNames: registered.map((s) => s.name) };
}

async function main() {
  let config: McpConfig;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      // stderr only — stdout is the MCP transport.
      console.error(`lebtech-mcp: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  const { server, registeredNames } = buildServer(config);
  console.error(
    `lebtech-mcp: target=${config.target} tools=${registeredNames.length} ` +
      `writes=${config.writesEnabled} destructive=${config.destructiveEnabled} frappeTier=${config.frappeTierEnabled}`,
  );
  await server.connect(new StdioServerTransport());
}

// Only start the transport when executed directly (not when imported by tests).
const isDirectRun = process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts");
if (isDirectRun) {
  main().catch((err) => {
    console.error("lebtech-mcp fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
