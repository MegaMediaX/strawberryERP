import { z } from "zod";
import type { ToolSpec } from "../registry.js";

export const telephonyTools: ToolSpec[] = [
  {
    name: "call_dial",
    description:
      "Enqueue a click-to-call dial for the current session's seat. The app's own TELEPHONY_LIVE_DIAL flag decides whether this is a real PBX call or a simulated one — this tool never overrides it. The lead (if given) must be in the caller's scope.",
    tier: "portal",
    gate: "write",
    schema: {
      number: z.string().min(1).describe("Number to dial (normalized server-side to local trunk digits)"),
      leadId: z.string().optional(),
    },
    handler: async (args, ctx) =>
      ctx.portal.request("/api/calls/dial", { method: "POST", body: { number: args.number, leadId: args.leadId } }),
  },
  {
    name: "call_disposition",
    description:
      "Record a call outcome against a lead: validated status transition, optional follow-up and acquired contact info.",
    tier: "portal",
    gate: "write",
    schema: {
      leadId: z.string().min(1),
      disposition: z.string().min(1).describe("Outcome tag, e.g. Interested / No Answer"),
      notes: z.string().optional(),
      followUp: z.string().optional().describe("ISO datetime for follow-up"),
      acquiredPhone: z.string().optional(),
      acquiredEmail: z.string().optional(),
      externalId: z.string().optional().describe("Call Record external_id to link"),
    },
    handler: async (args, ctx) => ctx.portal.request("/api/calls/disposition", { method: "POST", body: args }),
  },
];
