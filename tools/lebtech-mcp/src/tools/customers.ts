import type { ToolSpec } from "../registry.js";
import { paginationQuery, paginationShape, recordPayload } from "./shared.js";

export const customerTools: ToolSpec[] = [
  {
    name: "customers_list",
    description: "List customers visible to the current portal session (role-scoped, paginated).",
    tier: "portal",
    gate: "read",
    schema: { ...paginationShape },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/customers", { query: paginationQuery(args) }),
  },
  {
    name: "customer_create",
    description:
      "Create a customer. Payload fields follow the portal customer shape (name/company, country — validated against the caller's allowed countries — email, phone, reseller, notes, ...).",
    tier: "portal",
    gate: "write",
    schema: {
      payload: recordPayload.describe("Customer fields; country is validated app-side"),
    },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/customers", { method: "POST", body: args.payload }),
  },
  {
    name: "customer_update",
    description: "Update a customer (partial). Include the customer id in the payload; protected fields are skipped app-side.",
    tier: "portal",
    gate: "write",
    schema: {
      payload: recordPayload.describe("Customer fields to update, including the id"),
    },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/customers", { method: "PATCH", body: args.payload }),
  },
];
