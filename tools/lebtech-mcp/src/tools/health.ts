import { z } from "zod";
import type { ToolSpec } from "../registry.js";

export const healthTools: ToolSpec[] = [
  {
    name: "health_check",
    description:
      "Check platform health via the portal health endpoints. probe=deep checks frontend+Frappe readiness (may return 503 when degraded), live is a pure liveness ping, ready checks Frappe readiness only.",
    tier: "portal",
    gate: "read",
    schema: {
      probe: z.enum(["deep", "live", "ready"]).optional().describe("Which health endpoint to hit (default deep)"),
    },
    handler: async (args, ctx) => {
      const probe = (args.probe as string | undefined) ?? "deep";
      const path = probe === "deep" ? "/api/health" : `/api/health/${probe}`;
      return ctx.portal.request(path);
    },
  },
  {
    name: "portal_whoami",
    description:
      "Return the portal session identity the MCP server is acting as (user id, name, role, effective role, impersonation state). Useful to verify auth before other calls.",
    tier: "portal",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.portal.request("/api/auth/session"),
  },
];
