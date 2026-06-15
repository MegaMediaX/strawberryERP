import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalUser } from "@/lib/portal-security";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Reseller team performance + workload (spec §7/§22). Pure + unit-testable:
 * per-member tallies derived from the reseller's already-scoped lead list, with
 * `now` injected for deterministic follow-up bucketing. Only metrics with real
 * backing data are computed — Last Active and Converted-this-month are NOT
 * derivable (no per-member activity timestamp; customers carry no assignee /
 * conversion date), so the UI renders them as "—" / omits them honestly.
 */

const NOT_INTERESTED = "Contacted (Not Interested)";
const INTERESTED = "Contacted (Interested)";

export interface TeamMemberStat {
  id: string;
  name: string;
  role: string;
  countries: string[];
  /** Leads assigned to this member, excluding "Not Interested". */
  activeLeads: number;
  followUpsToday: number;
  overdue: number;
  interested: number;
  status: "Active" | "Inactive";
}

export function teamPerformance(
  users: readonly PortalUser[],
  leads: readonly PortalLead[],
  now: Date,
): TeamMemberStat[] {
  return users.map((u) => {
    const mine = leads.filter((l) => l.assignedTo === u.name);
    let activeLeads = 0, followUpsToday = 0, overdue = 0, interested = 0;
    for (const l of mine) {
      if (l.status !== NOT_INTERESTED) activeLeads += 1;
      if (l.status === INTERESTED) interested += 1;
      const bucket = bucketFollowUp(l.followUp, now);
      if (bucket === "Today") followUpsToday += 1;
      else if (bucket === "Overdue") overdue += 1;
    }
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      countries: [...u.countries],
      activeLeads,
      followUpsToday,
      overdue,
      interested,
      status: u.active ? "Active" : "Inactive",
    };
  });
}
