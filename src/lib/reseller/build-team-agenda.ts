import { buildAgenda, type AgendaSection } from "@/lib/sales/build-agenda";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Reseller team calendar agenda (spec §23). Pure + unit-testable. Applies the
 * reseller's team filters (salesperson / country / priority) to the already
 * reseller-scoped leads, then delegates to the tested `buildAgenda` for the
 * day-bucketing. Hooks-only: events are derived from lead follow-up dates — no
 * live Google Calendar.
 */
export interface TeamAgendaFilters {
  salesperson?: string;
  country?: string;
  priority?: string;
}

export function buildTeamAgenda(
  leads: readonly PortalLead[],
  filters: TeamAgendaFilters,
  now: Date,
): AgendaSection[] {
  const filtered = leads.filter((l) => {
    if (filters.salesperson && l.assignedTo !== filters.salesperson) return false;
    if (filters.country && l.country !== filters.country) return false;
    if (filters.priority && l.priority !== filters.priority) return false;
    return true;
  });
  return buildAgenda(filtered, now);
}

/** Total scheduled (non-empty-bucket) items across the agenda, for the header count. */
export function agendaCount(sections: readonly AgendaSection[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0);
}
