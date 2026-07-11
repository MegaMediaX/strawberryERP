import { z } from "zod";
import type { ToolSpec } from "../registry.js";

/**
 * Destructive portal tools: registered only when MCP_WRITES_ENABLED and
 * MCP_DESTRUCTIVE_ENABLED are both true, and each call must pass confirm:true.
 * Every result echoes what was done. Note the platform itself never hard-deletes
 * outside the delete queue; these tools drive that queue.
 */
export const destructiveTools: ToolSpec[] = [
  {
    name: "admin_delete_request",
    description:
      "Queue a soft-delete request for an entity (goes to the delete queue for Super Admin resolution — never a hard delete). Requires confirm:true.",
    tier: "portal",
    gate: "destructive",
    schema: {
      entityType: z.string().min(1).describe("e.g. lead, customer, invoice"),
      entityId: z.string().min(1),
      reason: z.string().min(1),
      label: z.string().optional(),
      country: z.string().optional(),
      reseller: z.string().optional(),
      confirm: z.boolean().optional().describe("Must be set to true to proceed; omitting it returns a structured refusal echoing the action"),
    },
    describeAction: (args) => `Queue delete request for ${args.entityType} ${args.entityId} (reason: ${args.reason})`,
    handler: async (args, ctx) => {
      const { confirm: _confirm, ...body } = args;
      return ctx.portal.request("/api/admin/delete-request", { method: "POST", body });
    },
  },
  {
    name: "admin_delete_queue_resolve",
    description:
      "Resolve one delete-queue item: action=restore puts the record back, action=permanent deletes it permanently. Super Admin only, blocked while impersonating. Requires confirm:true.",
    tier: "portal",
    gate: "destructive",
    schema: {
      id: z.string().min(1).describe("Delete-queue item id"),
      action: z.enum(["restore", "permanent"]),
      confirm: z.boolean().optional().describe("Must be set to true to proceed; omitting it returns a structured refusal echoing the action"),
    },
    describeAction: (args) => `Resolve delete-queue item ${args.id} with action=${args.action}`,
    handler: async (args, ctx) =>
      ctx.portal.request("/api/admin/delete-queue", { method: "PATCH", body: { id: args.id, action: args.action } }),
  },
  {
    name: "admin_delete_queue_clear_all",
    description:
      "Clear the ENTIRE delete queue (bulk permanent operation). The portal additionally requires its own typed confirmation phrase in confirmPhrase. Requires confirm:true.",
    tier: "portal",
    gate: "destructive",
    schema: {
      confirmPhrase: z.string().min(1).describe("The typed confirmation phrase the portal expects"),
      confirm: z.boolean().optional().describe("Must be set to true to proceed; omitting it returns a structured refusal echoing the action"),
    },
    describeAction: () => "Clear ALL items in the delete queue (bulk permanent resolution)",
    handler: async (args, ctx) =>
      ctx.portal.request("/api/admin/delete-queue", {
        method: "POST",
        body: { action: "clear-all", confirm: args.confirmPhrase },
      }),
  },
  {
    name: "admin_commission_cancel",
    description: "Cancel a commission entry (terminal state). Requires confirm:true.",
    tier: "portal",
    gate: "destructive",
    schema: {
      id: z.string().min(1).describe("Commission entry id"),
      confirm: z.boolean().optional().describe("Must be set to true to proceed; omitting it returns a structured refusal echoing the action"),
    },
    describeAction: (args) => `Cancel commission entry ${args.id} (terminal state)`,
    handler: async (args, ctx) =>
      ctx.portal.request("/api/admin/commissions", { method: "PATCH", body: { id: args.id, action: "cancel" } }),
  },
];
