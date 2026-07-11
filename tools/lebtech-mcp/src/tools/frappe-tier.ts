import { z } from "zod";
import type { ToolSpec } from "../registry.js";
import { recordPayload } from "./shared.js";

const M = "lebtech_partner_platform.api";

const listLimits = {
  limit_start: z.number().int().min(0).optional(),
  limit_page_length: z.number().int().min(1).max(500).optional(),
  order_by: z.string().optional(),
};

function pick(args: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (args[key] !== undefined) out[key] = args[key];
  return out;
}

/**
 * FRAPPE tier: direct token-auth calls to whitelisted methods — effectively
 * Administrator, bypassing the portal's role scoping. The entire tier only
 * registers when MCP_FRAPPE_TIER_ENABLED=true; write/destructive gates still
 * apply on top.
 */
export const frappeTierTools: ToolSpec[] = [
  // ── reads ──────────────────────────────────────────────────────────────
  {
    name: "frappe_ping",
    description: "Verify Frappe token auth by asking who the API key authenticates as.",
    tier: "frappe",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.frappe.call("frappe.auth.get_logged_user"),
  },
  {
    name: "frappe_list_leads",
    description: "List Partner Lead documents directly from Frappe (unscoped Administrator view; filterable).",
    tier: "frappe",
    gate: "read",
    schema: {
      country: z.string().optional(),
      countries: z.string().optional().describe("CSV of countries"),
      reseller: z.string().optional(),
      assigned_user: z.string().optional(),
      ...listLimits,
    },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.leads.list_leads`, {
        params: pick(args, ["country", "countries", "reseller", "assigned_user", "limit_start", "limit_page_length", "order_by"]),
      }),
  },
  {
    name: "frappe_list_customers",
    description: "List Partner Customer documents directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: { country: z.string().optional(), reseller: z.string().optional(), ...listLimits },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.customers.list_customers`, {
        params: pick(args, ["country", "reseller", "limit_start", "limit_page_length", "order_by"]),
      }),
  },
  {
    name: "frappe_list_calls",
    description: "List Call Record documents (telephony) directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: {
      assigned_user: z.string().optional(),
      agent: z.string().optional(),
      reseller: z.string().optional(),
      countries: z.string().optional().describe("CSV"),
      from_ts: z.string().optional(),
      to_ts: z.string().optional(),
      ...listLimits,
    },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.calls.list_calls`, {
        params: pick(args, ["assigned_user", "agent", "reseller", "countries", "from_ts", "to_ts", "limit_start", "limit_page_length", "order_by"]),
      }),
  },
  {
    name: "frappe_list_invoices",
    description: "List Partner Invoice documents directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: { country: z.string().optional(), reseller: z.string().optional(), ...listLimits },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.invoices.list_invoices`, {
        params: pick(args, ["country", "reseller", "limit_start", "limit_page_length", "order_by"]),
      }),
  },
  {
    name: "frappe_list_receipts",
    description: "List Partner Receipt documents directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: { country: z.string().optional(), reseller: z.string().optional(), ...listLimits },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.receipts.list_receipts`, {
        params: pick(args, ["country", "reseller", "limit_start", "limit_page_length", "order_by"]),
      }),
  },
  {
    name: "frappe_list_commission_entries",
    description: "List Commission Entry documents directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: { status: z.string().optional(), country: z.string().optional(), reseller: z.string().optional() },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.commissions.list_commission_entries`, { params: pick(args, ["status", "country", "reseller"]) }),
  },
  {
    name: "frappe_list_resellers",
    description: "List Reseller documents directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.frappe.call(`${M}.operations.list_resellers`),
  },
  {
    name: "frappe_list_contracts",
    description: "List Contract documents directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: { country: z.string().optional(), reseller: z.string().optional() },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.operations.list_contracts`, { params: pick(args, ["country", "reseller"]) }),
  },
  {
    name: "frappe_report",
    description:
      "Run a backend report: catalog, revenue_by_country, revenue_by_reseller, lead_conversion, outstanding_invoices, commission_summary, pnl_summary, audit_summary (audit_summary is Super Admin only).",
    tier: "frappe",
    gate: "read",
    schema: {
      report: z.enum([
        "catalog",
        "revenue_by_country",
        "revenue_by_reseller",
        "lead_conversion",
        "outstanding_invoices",
        "commission_summary",
        "pnl_summary",
        "audit_summary",
      ]),
      params: recordPayload.optional().describe("Report-specific filters (from_date, to_date, country, reseller, user, currency)"),
    },
    handler: async (args, ctx) => {
      const report = args.report === "catalog" ? "report_catalog" : (args.report as string);
      return ctx.frappe.call(`${M}.reports.${report}`, { params: (args.params as Record<string, unknown>) ?? {} });
    },
  },
  {
    name: "frappe_white_label_get",
    description: "Read the stored white-label settings blob (Super Admin method).",
    tier: "frappe",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.frappe.call(`${M}.settings.get_white_label`),
  },
  {
    name: "frappe_integration_settings_list",
    description: "List integration settings (secrets masked server-side).",
    tier: "frappe",
    gate: "read",
    schema: { integration_type: z.string().optional() },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.settings.list_integration_settings`, { params: pick(args, ["integration_type"]) }),
  },
  {
    name: "frappe_api_keys_list",
    description: "List Portal API Keys (hashes never returned).",
    tier: "frappe",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.frappe.call(`${M}.api_keys.list_api_keys`),
  },
  {
    name: "frappe_delete_queue_list",
    description: "List the Pending Delete Queue directly from Frappe.",
    tier: "frappe",
    gate: "read",
    schema: { status: z.string().optional() },
    handler: async (args, ctx) => ctx.frappe.call(`${M}.security.list_delete_queue`, { params: pick(args, ["status"]) }),
  },
  {
    name: "frappe_validate_csv",
    description: "Dry-run validate a lead or customer CSV against import rules (no persistence).",
    tier: "frappe",
    gate: "read",
    schema: { kind: z.enum(["lead", "customer"]), csvText: z.string().min(1) },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.import_export.validate_${args.kind}_csv`, {
        httpMethod: "POST",
        params: { csv_text: args.csvText },
      }),
  },
  {
    name: "frappe_export_records",
    description:
      "CSV-export an allowlisted DocType (Invoice, Receipt, Commission Entry, Partner Lead/Customer/Invoice/Receipt, Activity Timeline). Sensitive columns stripped server-side. Super Admin method.",
    tier: "frappe",
    gate: "read",
    schema: { doctype: z.string().min(1), fields: z.string().optional().describe("CSV of field names") },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.import_export.export_records`, { params: pick(args, ["doctype", "fields"]) }),
  },
  // ── writes ─────────────────────────────────────────────────────────────
  {
    name: "frappe_create_lead",
    description: "Create a Partner Lead directly (snake_case payload: company_name, country, assigned_user, phone required).",
    tier: "frappe",
    gate: "write",
    schema: { payload: recordPayload.describe("Partner Lead fields (snake_case)") },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.leads.create_lead`, { httpMethod: "POST", params: args.payload as Record<string, unknown> }),
  },
  {
    name: "frappe_update_lead",
    description: "Update a Partner Lead directly (field-allowlisted server-side).",
    tier: "frappe",
    gate: "write",
    schema: { name: z.string().min(1).describe("Partner Lead docname"), payload: recordPayload },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.leads.update_lead`, {
        httpMethod: "POST",
        params: { name: args.name, ...(args.payload as Record<string, unknown>) },
      }),
  },
  {
    name: "frappe_convert_lead",
    description: "Convert a Partner Lead into an ERPNext Customer + Partner Customer mirror.",
    tier: "frappe",
    gate: "write",
    schema: { lead_name: z.string().min(1) },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.leads.convert_to_customer`, { httpMethod: "POST", params: { lead_name: args.lead_name } }),
  },
  {
    name: "frappe_create_customer",
    description: "Create a Partner Customer directly (snake_case payload).",
    tier: "frappe",
    gate: "write",
    schema: { payload: recordPayload },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.customers.create_customer`, { httpMethod: "POST", params: args.payload as Record<string, unknown> }),
  },
  {
    name: "frappe_update_customer",
    description: "Update a Partner Customer directly (protected fields skipped server-side).",
    tier: "frappe",
    gate: "write",
    schema: { name: z.string().min(1), payload: recordPayload },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.customers.update_customer`, {
        httpMethod: "POST",
        params: { name: args.name, ...(args.payload as Record<string, unknown>) },
      }),
  },
  {
    name: "frappe_upsert_call",
    description: "Idempotently upsert a Call Record keyed by external_id (telephony ingest path).",
    tier: "frappe",
    gate: "write",
    schema: { payload: recordPayload.describe("Call Record fields; external_id required") },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.calls.upsert_call`, { httpMethod: "POST", params: args.payload as Record<string, unknown> }),
  },
  {
    name: "frappe_upsert_country",
    description: "Create or update a Partner Country (Super Admin; blocked-country guard server-side). mode=create|update.",
    tier: "frappe",
    gate: "write",
    schema: { mode: z.enum(["create", "update"]), payload: recordPayload.describe("country_name required") },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.countries.${args.mode}_country`, { httpMethod: "POST", params: args.payload as Record<string, unknown> }),
  },
  {
    name: "frappe_upsert_reseller",
    description: "Create or update a Reseller (Super Admin). mode=create|update.",
    tier: "frappe",
    gate: "write",
    schema: { mode: z.enum(["create", "update"]), payload: recordPayload.describe("reseller_name/name required") },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.operations.${args.mode}_reseller`, { httpMethod: "POST", params: args.payload as Record<string, unknown> }),
  },
  {
    name: "frappe_white_label_save",
    description: "Persist the white-label settings blob (Super Admin method).",
    tier: "frappe",
    gate: "write",
    schema: { settings: recordPayload },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.settings.save_white_label`, { httpMethod: "POST", params: { settings: args.settings } }),
  },
  {
    name: "frappe_integration_setting_upsert",
    description: "Upsert an Integration Setting (WhatsApp/SMTP/Google...). Secrets masked in the response.",
    tier: "frappe",
    gate: "write",
    schema: { payload: recordPayload },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.settings.upsert_integration_setting`, {
        httpMethod: "POST",
        params: args.payload as Record<string, unknown>,
      }),
  },
  {
    name: "frappe_update_commission_entry_status",
    description: "Transition a Commission Entry status (Pending/Approved/Paid/Cancelled) directly in Frappe.",
    tier: "frappe",
    gate: "write",
    schema: { name: z.string().min(1), status: z.enum(["Pending", "Approved", "Paid", "Cancelled"]) },
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.commissions.update_commission_entry_status`, {
        httpMethod: "POST",
        params: { name: args.name, status: args.status },
      }),
  },
  // ── destructive ────────────────────────────────────────────────────────
  {
    name: "frappe_queue_delete",
    description: "Queue a soft-delete request for a document (goes to the Pending Delete Queue). Requires confirm:true.",
    tier: "frappe",
    gate: "destructive",
    schema: {
      target_doctype: z.string().min(1),
      target_name: z.string().min(1),
      reason: z.string().optional(),
      confirm: z.boolean().optional().describe("Must be set to true to proceed; omitting it returns a structured refusal echoing the action"),
    },
    describeAction: (args) => `Queue delete request for ${args.target_doctype} ${args.target_name}`,
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.security.queue_delete_request`, {
        httpMethod: "POST",
        params: pick(args, ["target_doctype", "target_name", "reason"]),
      }),
  },
  {
    name: "frappe_resolve_delete_request",
    description:
      "Resolve a delete-queue item: restore or PERMANENTLY delete (action=clear_all wipes the whole queue). Super Admin method. Requires confirm:true.",
    tier: "frappe",
    gate: "destructive",
    schema: {
      name: z.string().optional().describe("Delete-queue docname (omit for clear_all)"),
      status: z.string().optional().describe("e.g. Restored / Deleted"),
      action: z.string().optional().describe("clear_all to wipe the queue"),
      confirm: z.boolean().optional().describe("Must be set to true to proceed; omitting it returns a structured refusal echoing the action"),
    },
    describeAction: (args) =>
      args.action === "clear_all"
        ? "Clear the ENTIRE Pending Delete Queue"
        : `Resolve delete request ${args.name} with status=${args.status}`,
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.security.resolve_delete_request`, {
        httpMethod: "POST",
        params: pick(args, ["name", "status", "action"]),
      }),
  },
  {
    name: "frappe_two_factor_remove",
    description: "Delete a user's 2FA secret (server-side TOTP store). Requires confirm:true.",
    tier: "frappe",
    gate: "destructive",
    schema: { user: z.string().min(1), confirm: z.boolean().optional().describe("Must be set to true to proceed; omitting it returns a structured refusal echoing the action") },
    describeAction: (args) => `Remove the 2FA secret for user ${args.user}`,
    handler: async (args, ctx) =>
      ctx.frappe.call(`${M}.two_factor.remove`, { httpMethod: "POST", params: { user: args.user } }),
  },
];
