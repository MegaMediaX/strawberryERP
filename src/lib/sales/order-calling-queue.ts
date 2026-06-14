import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import { priorityRank } from "@/lib/sales/lead-filters";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Next-best-lead ordering for Start-Calling mode (spec §4/§5). PURE: `now` is
 * injected (no Date.now() inside) so it is fully unit-testable.
 *
 * Primary order (spec §4):
 *   0 VIP overdue → 1 overdue follow-up → 2 today follow-up →
 *   3 interested lead → 4 new lead → 5 everything else.
 * Ties broken by priority (VIP > High > Medium > Low).
 */
const INTERESTED = "Contacted (Interested)";

export function callPrimaryRank(lead: PortalLead, now: Date): number {
  const bucket = bucketFollowUp(lead.followUp, now);
  if (lead.priority === "VIP" && bucket === "Overdue") return 0;
  if (bucket === "Overdue") return 1;
  if (bucket === "Today") return 2;
  if (lead.status === INTERESTED) return 3;
  if (lead.status.startsWith("New Lead")) return 4;
  return 5;
}

export function orderLeadsForCalling(leads: readonly PortalLead[], now: Date): PortalLead[] {
  return [...leads].sort((a, b) => {
    const pa = callPrimaryRank(a, now);
    const pb = callPrimaryRank(b, now);
    if (pa !== pb) return pa - pb;
    return priorityRank(a.priority) - priorityRank(b.priority);
  });
}
