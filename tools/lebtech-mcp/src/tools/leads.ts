import { z } from "zod";
import type { ToolSpec } from "../registry.js";
import { paginationQuery, paginationShape } from "./shared.js";

const leadFieldsShape = {
  companyName: z.string().optional(),
  country: z.string().optional(),
  assignedUser: z.string().optional().describe("Display name of the sales owner (portal users are frontend-only, not Frappe Users)"),
  contactFirstName: z.string().optional(),
  contactLastName: z.string().optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  status: z.string().optional().describe("Lead status — transitions are validated app-side"),
  followUpDate: z.string().optional().describe("ISO date; required when status is Scheduled Follow-Up"),
  notes: z.string().optional(),
  source: z.string().optional(),
};

export const leadTools: ToolSpec[] = [
  {
    name: "leads_list",
    description:
      "List leads visible to the current portal session (role-scoped, paginated). Filters: status, country, priority. Returns { data, page, pageSize, total, totalPages }.",
    tier: "portal",
    gate: "read",
    schema: {
      ...paginationShape,
      status: z.string().optional(),
      country: z.string().optional(),
      priority: z.string().optional(),
    },
    handler: async (args, ctx) =>
      ctx.portal.request("/api/frappe/leads", {
        query: {
          ...paginationQuery(args),
          status: args.status as string | undefined,
          country: args.country as string | undefined,
          priority: args.priority as string | undefined,
        },
      }),
  },
  {
    name: "lead_create",
    description:
      "Create a lead. Required: companyName, country, assignedUser, phone. Country must be in the caller's allowed countries; assignment scope is enforced app-side.",
    tier: "portal",
    gate: "write",
    schema: {
      companyName: z.string().min(1),
      country: z.string().min(1),
      assignedUser: z.string().min(1),
      phone: z.string().min(1),
      ...Object.fromEntries(Object.entries(leadFieldsShape).filter(([k]) => !["companyName", "country", "assignedUser", "phone"].includes(k))),
    },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/leads", { method: "POST", body: args }),
  },
  {
    name: "lead_update",
    description:
      "Update a lead by id (partial update). Status transitions are validated app-side; Scheduled Follow-Up requires followUpDate.",
    tier: "portal",
    gate: "write",
    schema: {
      id: z.string().min(1).describe("Lead id (Frappe name / dev-store id)"),
      ...leadFieldsShape,
    },
    handler: async (args, ctx) => ctx.portal.request("/api/frappe/leads", { method: "PATCH", body: args }),
  },
  {
    name: "lead_import_simulate",
    description:
      "Validate a batch of lead records against the CSV import rules. SIMULATE-ONLY: the portal route never persists imported rows; it returns a summary of accepted/rejected records.",
    tier: "portal",
    gate: "write",
    schema: {
      records: z.array(z.record(z.unknown())).min(1).describe("Lead rows (companyName, country, assignedUser, phone, ...)"),
      duplicatePolicy: z.string().describe("Duplicate handling policy, e.g. 'skip'"),
    },
    handler: async (args, ctx) =>
      ctx.portal.request("/api/frappe/leads/import", {
        method: "POST",
        body: { records: args.records, duplicatePolicy: args.duplicatePolicy },
      }),
  },
];
