import type { PortalLead } from "@/lib/ui-data";

/**
 * Sales dashboard hero counts (spec §2/§4). Pure + unit-testable. Operates on
 * the already-scoped lead list (the leads API restricts a Sales user to their
 * assigned records), so these counts are inherently sales-scoped.
 */
export interface SalesDashboardSummary {
  assigned: number;
  interested: number;
  newLeads: number;
  scheduled: number;
}

const INTERESTED = "Contacted (Interested)";
const SCHEDULED = "Scheduled Follow-Up";

export function salesDashboardSummary(leads: readonly PortalLead[]): SalesDashboardSummary {
  let interested = 0;
  let newLeads = 0;
  let scheduled = 0;
  for (const lead of leads) {
    if (lead.status === INTERESTED) interested += 1;
    else if (lead.status === SCHEDULED) scheduled += 1;
    if (lead.status.startsWith("New Lead")) newLeads += 1;
  }
  return { assigned: leads.length, interested, newLeads, scheduled };
}

/** Greeting based on a provided hour (0–23), passed in so the fn stays pure. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
