import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Reseller leads saved views (spec §8). Pure + unit-testable. Each view is a
 * predicate over the already-reseller-scoped lead list; `now` is injected so
 * follow-up bucketing is deterministic.
 */
export type SavedViewKey =
  | "active" | "unassigned" | "today" | "overdue" | "interested" | "no-activity" | "vip";

export const savedViews: { key: SavedViewKey; label: string }[] = [
  { key: "active", label: "All active" },
  { key: "unassigned", label: "Unassigned" },
  { key: "today", label: "Follow-ups today" },
  { key: "overdue", label: "Overdue" },
  { key: "interested", label: "Interested" },
  { key: "no-activity", label: "No activity" },
  { key: "vip", label: "VIP" },
];

const NOT_INTERESTED = "Contacted (Not Interested)";

function isUnassigned(lead: PortalLead): boolean {
  const a = (lead.assignedTo ?? "").trim().toLowerCase();
  return a === "" || a === "unassigned";
}

export function applySavedView(leads: readonly PortalLead[], key: SavedViewKey, now: Date): PortalLead[] {
  switch (key) {
    case "active":
      return leads.filter((l) => l.status !== NOT_INTERESTED);
    case "unassigned":
      return leads.filter(isUnassigned);
    case "today":
      return leads.filter((l) => bucketFollowUp(l.followUp, now) === "Today");
    case "overdue":
      return leads.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue");
    case "interested":
      return leads.filter((l) => l.status === "Contacted (Interested)");
    case "no-activity":
      return leads.filter((l) => !l.notes.trim());
    case "vip":
      return leads.filter((l) => l.priority === "VIP");
    default:
      return [...leads];
  }
}
