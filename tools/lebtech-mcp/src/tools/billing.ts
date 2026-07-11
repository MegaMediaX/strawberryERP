import { z } from "zod";
import type { ToolSpec } from "../registry.js";
import { paginationQuery, paginationShape, recordPayload } from "./shared.js";

export const billingTools: ToolSpec[] = [
  {
    name: "invoices_list",
    description: "List invoices visible to the current portal session (role-scoped, paginated).",
    tier: "portal",
    gate: "read",
    schema: { ...paginationShape },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/invoices", { query: paginationQuery(args) }),
  },
  {
    name: "invoice_get",
    description: "Fetch one invoice by id.",
    tier: "portal",
    gate: "read",
    schema: { id: z.string().min(1) },
    handler: async (args, ctx) => ctx.portal.request(`/api/frappe/invoices/${encodeURIComponent(String(args.id))}`),
  },
  {
    name: "invoice_create",
    description: "Create an invoice (line items, customer, country, currency). Commission entries are computed app-side.",
    tier: "portal",
    gate: "write",
    schema: { payload: recordPayload.describe("Invoice fields (customer, country, items/lineItems, currency, ...)") },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/invoices", { method: "POST", body: args.payload }),
  },
  {
    name: "invoice_update",
    description: "Update an invoice (partial). Include the invoice id in the payload; totals/status protections apply app-side.",
    tier: "portal",
    gate: "write",
    schema: { payload: recordPayload.describe("Invoice fields to update, including the id") },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/invoices", { method: "PATCH", body: args.payload }),
  },
  {
    name: "receipts_list",
    description: "List receipts visible to the current portal session (role-scoped, paginated).",
    tier: "portal",
    gate: "read",
    schema: { ...paginationShape },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/receipts", { query: paginationQuery(args) }),
  },
  {
    name: "receipt_create",
    description: "Record a receipt against an invoice. Payment status + commissions update app-side.",
    tier: "portal",
    gate: "write",
    schema: { payload: recordPayload.describe("Receipt fields (invoice, amount, method, date, ...)") },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/receipts", { method: "POST", body: args.payload }),
  },
  {
    name: "receipt_update",
    description: "Update a receipt (partial). Include the receipt id in the payload.",
    tier: "portal",
    gate: "write",
    schema: { payload: recordPayload.describe("Receipt fields to update, including the id") },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/receipts", { method: "PATCH", body: args.payload }),
  },
  {
    name: "commissions_list",
    description:
      "List commission data. kind=summary lists commission overview, kind=entries lists commission entries, kind=rules lists commission rules.",
    tier: "portal",
    gate: "read",
    schema: {
      kind: z.enum(["summary", "entries", "rules"]).optional().describe("Which commission collection (default summary)"),
      ...paginationShape,
    },
    handler: async (args, ctx) => {
      const kind = (args.kind as string | undefined) ?? "summary";
      const path = kind === "summary" ? "/api/frappe/commissions" : `/api/frappe/commissions/${kind}`;
      return ctx.portal.request(path, { query: paginationQuery(args) });
    },
  },
  {
    name: "commission_entry_update",
    description:
      "Transition a commission entry's status (Pending/Approved/Paid). Approval rules are enforced app-side. Cancelling is a separate destructive tool (admin_commission_cancel).",
    tier: "portal",
    gate: "write",
    schema: {
      id: z.string().min(1).describe("Commission entry id"),
      status: z.enum(["Pending", "Approved", "Paid"]).describe("Target status"),
    },
    handler: async (args, ctx) =>
      ctx.portal.request("/api/frappe/commissions/entries", { method: "PATCH", body: { id: args.id, status: args.status } }),
  },
];
