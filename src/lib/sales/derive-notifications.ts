import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Sales notifications (spec §20) — HOOKS ONLY, derived client-side from the
 * user's already-scoped leads (no push backend). Pragmatic types from available
 * data: Follow-up Overdue, Follow-up Due (today), Lead Assigned (new leads).
 * PURE: `now` injected for deterministic tests.
 */
export type SalesNotificationType = "overdue" | "due" | "assigned";

export interface SalesNotification {
  id: string;
  type: SalesNotificationType;
  leadId: string;
  title: string;
  detail: string;
}

const ORDER: Record<SalesNotificationType, number> = { overdue: 0, due: 1, assigned: 2 };

export function deriveNotifications(leads: readonly PortalLead[], now: Date): SalesNotification[] {
  const out: SalesNotification[] = [];
  for (const lead of leads) {
    const bucket = bucketFollowUp(lead.followUp, now);
    if (bucket === "Overdue") {
      out.push({ id: `overdue-${lead.id}`, type: "overdue", leadId: lead.id, title: lead.company, detail: `Overdue follow-up · ${lead.followUp}` });
    } else if (bucket === "Today") {
      out.push({ id: `due-${lead.id}`, type: "due", leadId: lead.id, title: lead.company, detail: `Follow-up due · ${lead.followUp}` });
    }
    if (lead.status.startsWith("New Lead")) {
      out.push({ id: `assigned-${lead.id}`, type: "assigned", leadId: lead.id, title: lead.company, detail: `New lead assigned · ${lead.contact}` });
    }
  }
  return out.sort((a, b) => ORDER[a.type] - ORDER[b.type]);
}
