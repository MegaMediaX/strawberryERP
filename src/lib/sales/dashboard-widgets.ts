import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Sales dashboard priority widgets (spec §3) — work-to-do-today panels, NOT
 * revenue. Pure + unit-testable; counts come from the already-sales-scoped lead
 * list, and `now` is injected so follow-up bucketing stays deterministic.
 */
export interface DashboardWidget {
  key: string;
  label: string;
  value: number | string;
  href: string;
  tone: "rose" | "amber" | "green" | "blue" | "violet" | "neutral";
}

const INTERESTED = "Contacted (Interested)";
const ATTEMPTED = "Attempted Contact (No Response)";

export function salesDashboardWidgets(leads: readonly PortalLead[], now: Date): DashboardWidget[] {
  const buckets = leads.map((l) => bucketFollowUp(l.followUp, now));
  const today = buckets.filter((b) => b === "Today").length;
  const overdue = buckets.filter((b) => b === "Overdue").length;
  const interested = leads.filter((l) => l.status === INTERESTED).length;
  const newLeads = leads.filter((l) => l.status.startsWith("New Lead")).length;
  const attempted = leads.filter((l) => l.status === ATTEMPTED).length;
  // "Recently updated" — leads with at least one note (a proxy for touched).
  const recentlyUpdated = leads.filter((l) => l.notes.trim().length > 0).length;
  // Conversions are not tracked on the lead record in dev-store → 0 placeholder.
  const convertedThisMonth = 0;
  const interestRate = leads.length ? Math.round((interested / leads.length) * 100) : 0;

  return [
    { key: "today", label: "Today's follow-ups", value: today, href: "/sales/follow-ups", tone: "amber" },
    { key: "overdue", label: "Overdue follow-ups", value: overdue, href: "/sales/follow-ups", tone: "rose" },
    { key: "interested", label: "Interested leads", value: interested, href: "/sales/leads", tone: "green" },
    { key: "new", label: "New leads", value: newLeads, href: "/sales/leads", tone: "blue" },
    { key: "attempted", label: "Attempted / no response", value: attempted, href: "/sales/leads", tone: "neutral" },
    { key: "recent", label: "Recently updated", value: recentlyUpdated, href: "/sales/leads", tone: "violet" },
    { key: "converted", label: "Converted this month", value: convertedThisMonth, href: "/sales/leads", tone: "green" },
    { key: "performance", label: "Interest rate", value: `${interestRate}%`, href: "/sales/leads", tone: "blue" },
  ];
}
