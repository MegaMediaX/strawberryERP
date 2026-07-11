import { z } from "zod";
import type { ToolSpec } from "../registry.js";
import { paginationQuery, paginationShape, recordPayload } from "./shared.js";

/**
 * Super-Admin portal surfaces. Writes to countries/resellers/white-label
 * inherit the app's ADMIN_FRAPPE_WRITE_VERIFIED quarantine: when the flag is
 * off app-side the write lands in the dev-store (or 501s) — that outcome is
 * surfaced verbatim, never worked around.
 */
export const adminTools: ToolSpec[] = [
  {
    name: "countries_list",
    description: "List platform countries (Super Admin scope).",
    tier: "portal",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.portal.request("/api/admin/countries"),
  },
  {
    name: "resellers_list",
    description: "List resellers visible to the current portal session.",
    tier: "portal",
    gate: "read",
    schema: { ...paginationShape },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/resellers", { query: paginationQuery(args) }),
  },
  {
    name: "contracts_list",
    description: "List contracts, optionally filtered by customer (reseller-scoped).",
    tier: "portal",
    gate: "read",
    schema: { customer: z.string().optional() },
    handler: async (args, ctx) =>
      ctx.portal.request("/api/frappe/contracts", { query: { customer: args.customer as string | undefined } }),
  },
  {
    name: "delete_queue_list",
    description: "List the soft-delete queue (pending delete/restore requests).",
    tier: "portal",
    gate: "read",
    schema: {},
    handler: async (_args, ctx) => ctx.portal.request("/api/frappe/delete-queue"),
  },
  {
    name: "admin_country_create",
    description:
      "Create a country (Super Admin). Blocked-country rules (§42) and unique name/prefix are enforced app-side. Frappe persistence is quarantined behind the app's ADMIN_FRAPPE_WRITE_VERIFIED flag.",
    tier: "portal",
    gate: "write",
    schema: {
      name: z.string().min(1),
      currency: z.string().min(1),
      timezone: z.string().min(1),
      invoicePrefix: z.string().min(2).describe("2-12 chars: A-Z, 0-9, hyphen"),
      paymentMethods: z.array(z.string()).optional(),
    },
    handler: async (args, ctx) => ctx.portal.request("/api/admin/countries", { method: "POST", body: args }),
  },
  {
    name: "admin_country_update",
    description: "Edit a country or toggle its active state (Super Admin). Same payload as create plus active/deactivate flags.",
    tier: "portal",
    gate: "write",
    schema: { payload: recordPayload.describe("Country fields (name identifies the record; active?: boolean to toggle)") },
    handler: async (args, ctx) => ctx.portal.request("/api/admin/countries", { method: "PATCH", body: args.payload }),
  },
  {
    name: "admin_reseller_create",
    description: "Create a reseller (Super Admin). Frappe persistence quarantined behind ADMIN_FRAPPE_WRITE_VERIFIED app-side.",
    tier: "portal",
    gate: "write",
    schema: {
      name: z.string().min(1),
      countries: z.array(z.string()).min(1),
      defaultCurrency: z.string().min(1),
      defaultCommissionPercentage: z.number().min(0).max(100),
      defaultCommissionTrigger: z.enum(["Invoice Created", "Deposit Paid", "Fully Paid"]),
      visibility: z.enum(["All Countries", "Assigned Countries"]),
      isActive: z.boolean().optional(),
    },
    handler: async (args, ctx) => ctx.portal.request("/api/admin/resellers", { method: "POST", body: args }),
  },
  {
    name: "admin_reseller_update",
    description: "Edit a reseller or toggle its active state (Super Admin).",
    tier: "portal",
    gate: "write",
    schema: { payload: recordPayload.describe("Reseller fields (name identifies the record)") },
    handler: async (args, ctx) => ctx.portal.request("/api/admin/resellers", { method: "PATCH", body: args.payload }),
  },
  {
    name: "admin_white_label_update",
    description:
      "Update white-label branding settings (Super Admin). Merged with stored settings app-side; Frappe persistence quarantined behind ADMIN_FRAPPE_WRITE_VERIFIED.",
    tier: "portal",
    gate: "write",
    schema: { settings: recordPayload.describe("Partial WhiteLabelSettings to merge") },
    handler: async (args, ctx) => ctx.portal.request("/api/admin/white-label", { method: "PATCH", body: args.settings }),
  },
  {
    name: "admin_user_create",
    description:
      "Create a platform user (Super Admin, §11). Role must be below Super Admin; Regional Director/Sales need countries, Reseller Admin/Sales need a reseller. NOTE: dev-store users are frontend-only, not Frappe Users.",
    tier: "portal",
    gate: "write",
    schema: {
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      role: z.enum(["Regional Director", "Reseller Admin", "Sales Team User"]),
      countries: z.array(z.string()).optional(),
      reseller: z.string().optional(),
      password: z.string().min(1),
    },
    handler: async (args, ctx) =>
      ctx.portal.request("/api/admin/users", {
        method: "POST",
        body: { ...args, phone: args.phone ?? "", countries: args.countries ?? [], reseller: args.reseller ?? "" },
      }),
  },
  {
    name: "admin_user_update",
    description:
      "Update a platform user (Super Admin): action=reset_password|activate|deactivate, or edit scope fields (countries, reseller, phone).",
    tier: "portal",
    gate: "write",
    schema: {
      id: z.string().min(1).describe("Portal user id, e.g. USR-SALES-MARVEN"),
      action: z.enum(["reset_password", "activate", "deactivate"]).optional(),
      password: z.string().optional().describe("Required with action=reset_password"),
      countries: z.array(z.string()).optional(),
      reseller: z.string().optional(),
      phone: z.string().optional(),
    },
    handler: async (args, ctx) => {
      const { id, ...body } = args;
      return ctx.portal.request(`/api/admin/users/${encodeURIComponent(String(id))}`, { method: "PATCH", body });
    },
  },
];
