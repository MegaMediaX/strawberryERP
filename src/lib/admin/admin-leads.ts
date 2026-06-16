import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Super Admin global lead views + actions (spec §13/§14). Pure + unit-testable.
 * GLOBAL (unscoped) — all countries/resellers. The 7 §13 saved views + the
 * admin write actions (reassign/convert/archive). Honest proxies where the seed
 * lacks a field (no-activity = empty notes, recently-imported = New Lead).
 */

const INTERESTED = "Contacted (Interested)";
const NOT_INTERESTED = "Contacted (Not Interested)";
const UNASSIGNED = (l: PortalLead) => !l.assignedTo?.trim() || l.assignedTo === "Unassigned";

export type AdminLeadView =
  | "all" | "overdue" | "interested" | "vip" | "no-activity" | "unassigned" | "recently-imported";

export const adminLeadViews: { key: AdminLeadView; label: string }[] = [
  { key: "all", label: "All Active" },
  { key: "overdue", label: "Overdue Follow-Ups" },
  { key: "interested", label: "Interested" },
  { key: "vip", label: "VIP" },
  { key: "unassigned", label: "Unassigned" },
  { key: "no-activity", label: "No Activity" },
  { key: "recently-imported", label: "Recently Imported" },
];

export function applyAdminLeadView(leads: readonly PortalLead[], key: AdminLeadView, now: Date): PortalLead[] {
  switch (key) {
    case "overdue": return leads.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue");
    case "interested": return leads.filter((l) => l.status === INTERESTED);
    case "vip": return leads.filter((l) => l.priority === "VIP");
    case "unassigned": return leads.filter(UNASSIGNED);
    case "no-activity": return leads.filter((l) => !l.notes?.trim());
    case "recently-imported": return leads.filter((l) => l.status.startsWith("New Lead"));
    case "all":
    default: return leads.filter((l) => l.status !== NOT_INTERESTED);
  }
}

export type AdminLeadAction = "reassign" | "convert" | "archive" | "delete";

/** Validate a reassign target (must be a non-empty assignee). */
export function validateReassign(assignedTo: string | undefined): string | null {
  return assignedTo && assignedTo.trim() ? null : "Choose a user to reassign to.";
}

/** Human label for the audit trail of an admin lead action. */
export function leadActionAudit(action: AdminLeadAction, detail: string): { action: string; newValue: string } {
  const map: Record<AdminLeadAction, string> = { reassign: "reassign", convert: "convert", archive: "archive", delete: "delete_request" };
  return { action: map[action], newValue: detail };
}
