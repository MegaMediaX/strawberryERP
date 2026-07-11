import type { z } from "zod";
import type { McpConfig } from "./config.js";
import type { PortalClient } from "./portal/client.js";
import type { FrappeClient } from "./frappe/client.js";
import { jsonResult, refusal, type McpToolResult } from "./result.js";

export type Gate = "read" | "write" | "destructive";
export type Tier = "portal" | "frappe";

export interface ToolContext {
  config: McpConfig;
  portal: PortalClient;
  frappe: FrappeClient;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolSpec<S extends z.ZodRawShape = any> {
  name: string;
  description: string;
  tier: Tier;
  gate: Gate;
  schema: S;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  /** Human-readable echo of what a destructive call is about to do. */
  describeAction?: (args: Record<string, unknown>) => string;
}

/**
 * Gate model (mirrors the app's TELEPHONY_LIVE_DIAL / ADMIN_FRAPPE_WRITE_VERIFIED
 * flag-gate pattern):
 *  - read tools: always registered for their tier.
 *  - write tools: registered only when MCP_WRITES_ENABLED=true.
 *  - destructive tools: additionally require MCP_DESTRUCTIVE_ENABLED=true AND a
 *    confirm:true parameter per call, and echo what they are about to do.
 *  - frappe tier: only registers at all when MCP_FRAPPE_TIER_ENABLED=true.
 * Registration-time gating is the primary control; the runtime wrapper
 * re-checks as defense in depth and returns a STRUCTURED refusal, never throws.
 */
export function isRegistered(spec: ToolSpec, config: McpConfig): boolean {
  if (spec.tier === "frappe" && !config.frappeTierEnabled) return false;
  if (spec.gate === "write" && !config.writesEnabled) return false;
  if (spec.gate === "destructive" && !(config.writesEnabled && config.destructiveEnabled)) return false;
  return true;
}

export function selectTools(specs: ToolSpec[], config: McpConfig): ToolSpec[] {
  return specs.filter((spec) => isRegistered(spec, config));
}

export async function invokeTool(
  spec: ToolSpec,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<McpToolResult> {
  const { config } = ctx;
  if (spec.tier === "frappe" && !config.frappeTierEnabled) {
    return refusal({
      ok: false,
      refused: true,
      code: "FRAPPE_TIER_DISABLED",
      message: `${spec.name} belongs to the Frappe admin tier, which is disabled. Set MCP_FRAPPE_TIER_ENABLED=true to enable it.`,
    });
  }
  if (spec.gate !== "read" && !config.writesEnabled) {
    return refusal({
      ok: false,
      refused: true,
      code: "WRITES_DISABLED",
      message: `${spec.name} is a ${spec.gate} tool and writes are disabled. Set MCP_WRITES_ENABLED=true to enable write tools.`,
    });
  }
  if (spec.gate === "destructive") {
    const about = spec.describeAction?.(args) ?? spec.name;
    if (!config.destructiveEnabled) {
      return refusal({
        ok: false,
        refused: true,
        code: "DESTRUCTIVE_DISABLED",
        message: `${spec.name} is destructive and MCP_DESTRUCTIVE_ENABLED is not true.`,
        wouldHaveDone: about,
      });
    }
    if (args.confirm !== true) {
      return refusal({
        ok: false,
        refused: true,
        code: "CONFIRMATION_REQUIRED",
        message: `${spec.name} is destructive. Re-invoke with confirm:true to proceed.`,
        wouldHaveDone: about,
      });
    }
    try {
      const result = await spec.handler(args, ctx);
      const failed = !!result && typeof result === "object" && (result as { ok?: unknown }).ok === false;
      // Destructive results always echo what was done.
      return jsonResult({ action: about, result }, failed);
    } catch (err) {
      return jsonResult({ ok: false, code: "TOOL_ERROR", message: err instanceof Error ? err.message : String(err) }, true);
    }
  }
  try {
    const result = await spec.handler(args, ctx);
    const failed = !!result && typeof result === "object" && (result as { ok?: unknown }).ok === false;
    return jsonResult(result, failed);
  } catch (err) {
    return jsonResult({ ok: false, code: "TOOL_ERROR", message: err instanceof Error ? err.message : String(err) }, true);
  }
}
