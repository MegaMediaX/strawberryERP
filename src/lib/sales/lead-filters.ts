import type { PortalLead } from "@/lib/ui-data";

/**
 * Sales "My Leads" filtering + sorting (spec §14/§15). Pure + unit-testable.
 * Operates on the already-scoped lead list (the leads API restricts a Sales user
 * to assigned records), so output is inherently sales-scoped.
 */

export interface LeadFilters {
  status?: string;
  priority?: string;
  source?: string;
  country?: string;
  search?: string;
}

export type LeadSort = "priority" | "recent" | "status" | "company";

const PRIORITY_RANK: Record<string, number> = { VIP: 0, High: 1, Medium: 2, Low: 3 };

export function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority] ?? 99;
}

/** Apply the active filter set. Empty/unset fields match everything. */
export function filterLeads(leads: readonly PortalLead[], filters: LeadFilters): PortalLead[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return leads.filter((lead) => {
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.priority && lead.priority !== filters.priority) return false;
    if (filters.source && lead.source !== filters.source) return false;
    if (filters.country && lead.country !== filters.country) return false;
    if (search) {
      const haystack = [lead.company, lead.contact, lead.email, lead.phone, lead.id].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/** Stable sort by the chosen key. Default ("priority") floats VIP/High to the top. */
export function sortLeads(leads: readonly PortalLead[], sortBy: LeadSort = "priority"): PortalLead[] {
  const copy = [...leads];
  switch (sortBy) {
    case "priority":
      return copy.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    case "company":
      return copy.sort((a, b) => a.company.localeCompare(b.company));
    case "status":
      return copy.sort((a, b) => a.status.localeCompare(b.status));
    case "recent":
      // Most-recently-added first by id suffix (LEAD-#### — higher = newer).
      return copy.sort((a, b) => leadIdNumber(b.id) - leadIdNumber(a.id));
    default:
      return copy;
  }
}

function leadIdNumber(id: string): number {
  const m = id.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

/** Distinct values for a field, sorted — used to populate filter dropdowns. */
export function distinctValues(leads: readonly PortalLead[], field: keyof PortalLead): string[] {
  return [...new Set(leads.map((l) => String(l[field])))].filter(Boolean).sort();
}
