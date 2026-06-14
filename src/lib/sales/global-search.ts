import type { PortalLead } from "@/lib/ui-data";

/**
 * Sales global search (spec §23) — pure, scoped grouping across the user's leads
 * and accessible customers. Inputs are already role-scoped (leads via the scoped
 * leads query, customers via the permission-filtered boundary), so results are
 * inherently sales-scoped.
 */
export interface CustomerLite {
  id: string;
  name: string;
  country: string;
  reseller: string;
}

export interface SearchResults {
  leads: PortalLead[];
  customers: CustomerLite[];
}

const RECENT_LIMIT = 5;

/** Case-insensitive substring search; empty query → empty results. */
export function searchLeadsAndCustomers(
  leads: readonly PortalLead[],
  customers: readonly CustomerLite[],
  query: string,
): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { leads: [], customers: [] };
  return {
    leads: leads.filter((l) =>
      [l.company, l.contact, l.email, l.phone, l.id, l.status].join(" ").toLowerCase().includes(q),
    ),
    customers: customers.filter((c) =>
      [c.name, c.country, c.reseller, c.id].join(" ").toLowerCase().includes(q),
    ),
  };
}

/** Prepend a term to recents, de-duped (case-insensitive), trimmed to 5. */
export function saveRecentSearch(term: string, existing: readonly string[]): string[] {
  const t = term.trim();
  if (!t) return existing.slice(0, RECENT_LIMIT);
  return [t, ...existing.filter((e) => e.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_LIMIT);
}
