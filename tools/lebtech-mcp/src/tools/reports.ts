import { z } from "zod";
import type { ToolSpec } from "../registry.js";
import { paginationQuery, paginationShape } from "./shared.js";

export const reportTools: ToolSpec[] = [
  {
    name: "report_run",
    description:
      "Run a portal report, role-scoped. type=revenue (invoiced/collected totals + rows) or type=conversion (lead funnel). Optional date range and country/reseller/source filters (403 if out of the caller's scope).",
    tier: "portal",
    gate: "read",
    schema: {
      type: z.enum(["revenue", "conversion"]),
      startDate: z.string().optional().describe("ISO date"),
      endDate: z.string().optional().describe("ISO date"),
      country: z.string().optional(),
      reseller: z.string().optional(),
      source: z.string().optional(),
    },
    handler: async (args, ctx) =>
      ctx.portal.request(`/api/frappe/reports/${args.type}`, {
        query: {
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          country: args.country as string | undefined,
          reseller: args.reseller as string | undefined,
          source: args.source as string | undefined,
        },
      }),
  },
  {
    name: "report_pnl",
    description: "Profit & loss summary (revenue, receipts, commissions, expenses, profit), role-scoped.",
    tier: "portal",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.portal.request("/api/frappe/reports/pnl"),
  },
  {
    name: "call_kpis",
    description:
      "Call-center KPIs (team + per-agent) for a time window, role-scoped (Sales sees own calls, Reseller Admin their reseller, etc.).",
    tier: "portal",
    gate: "read",
    schema: {
      from: z.string().optional().describe("Window start (ISO)"),
      to: z.string().optional().describe("Window end (ISO)"),
    },
    handler: async (args, ctx) =>
      ctx.portal.request("/api/reports/call-kpis", {
        query: { from: args.from as string | undefined, to: args.to as string | undefined },
      }),
  },
  {
    name: "audit_logs_list",
    description: "List platform audit-log / activity-timeline entries (paginated).",
    tier: "portal",
    gate: "read",
    schema: { ...paginationShape },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/audit-logs", { query: paginationQuery(args) }),
  },
];
