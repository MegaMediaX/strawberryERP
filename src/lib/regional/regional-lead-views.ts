import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Regional leads saved views (spec §14). Pure + unit-testable; `now` injected
 * for deterministic follow-up bucketing. Data honesty: leads carry no created
 * date or conversion record, so "Newly added" = still-uncontacted New Leads and
 * "Converted this month" = late-funnel (Scheduled Follow-Up) as the closest
 * derivable proxy — labelled per spec but documented here.
 */
export type RegionalLeadView =
  | "all" | "overdue" | "interested" | "vip" | "no-activity" | "newly-added" | "converted";

export const regionalLeadViews: { key: RegionalLeadView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue follow-ups" },
  { key: "interested", label: "Interested" },
  { key: "vip", label: "VIP" },
  { key: "no-activity", label: "No activity" },
  { key: "newly-added", label: "Newly added" },
  { key: "converted", label: "Converted this month" },
];

const INTERESTED = "Contacted (Interested)";

export function applyRegionalLeadView(leads: readonly PortalLead[], key: RegionalLeadView, now: Date): PortalLead[] {
  switch (key) {
    case "overdue": return leads.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue");
    case "interested": return leads.filter((l) => l.status === INTERESTED);
    case "vip": return leads.filter((l) => l.priority === "VIP");
    case "no-activity": return leads.filter((l) => !l.notes.trim());
    case "newly-added": return leads.filter((l) => l.status.startsWith("New Lead"));
    case "converted": return leads.filter((l) => l.status === "Scheduled Follow-Up");
    case "all":
    default: return [...leads];
  }
}
