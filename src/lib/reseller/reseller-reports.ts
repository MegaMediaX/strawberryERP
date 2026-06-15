import { commissionSummary, type CommissionLike, type CommissionSummary } from "@/lib/reseller/commission-summary";
import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Reseller reports (spec §24). Pure + unit-testable aggregator over the already
 * reseller-scoped data. No global finance — only this reseller's pipeline, team
 * activity, invoices, commissions, lead sources, conversion and follow-up. The
 * UI renders the returned datasets as CSS bars / stat cards (no chart library).
 */

export interface ReportInvoiceRow { plainStatus: "Unpaid" | "Partially Paid" | "Paid"; total: number; country: string }
export interface ReportFilters { country?: string; salesperson?: string }

export interface CountBar { label: string; count: number }
export interface ResellerReports {
  pipeline: CountBar[];
  leadSources: CountBar[];
  team: CountBar[];
  followUp: { overdue: number; today: number; tomorrow: number; thisWeek: number; later: number };
  conversion: { total: number; interested: number; rate: number };
  invoices: { unpaid: number; partiallyPaid: number; paid: number; total: number };
  commissions: CommissionSummary;
}

function tally<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

const STAGE_LABEL: Record<string, string> = {
  "New Lead (Uncontacted)": "New",
  "Attempted Contact (No Response)": "Attempted",
  "Contacted (Awaiting Response)": "Awaiting",
  "Contacted (Not Interested)": "Not interested",
  "Contacted (Interested)": "Interested",
  "Scheduled Follow-Up": "Scheduled",
};

export function resellerReports(
  leads: readonly PortalLead[],
  invoices: readonly ReportInvoiceRow[],
  commissions: readonly CommissionLike[],
  filters: ReportFilters,
  now: Date,
): ResellerReports {
  const scopedLeads = leads.filter((l) =>
    (!filters.country || l.country === filters.country) &&
    (!filters.salesperson || l.assignedTo === filters.salesperson));
  const scopedInvoices = invoices.filter((i) => !filters.country || i.country === filters.country);

  const statusTally = tally(scopedLeads, (l) => l.status);
  const pipeline: CountBar[] = leadStatuses.map((s) => ({ label: STAGE_LABEL[s] ?? s, count: statusTally.get(s) ?? 0 }));

  const sourceTally = tally(scopedLeads, (l) => l.source);
  const leadSources: CountBar[] = [...sourceTally.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const teamTally = tally(scopedLeads, (l) => l.assignedTo);
  const team: CountBar[] = [...teamTally.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const followUp = { overdue: 0, today: 0, tomorrow: 0, thisWeek: 0, later: 0 };
  for (const l of scopedLeads) {
    const b = bucketFollowUp(l.followUp, now);
    if (b === "Overdue") followUp.overdue += 1;
    else if (b === "Today") followUp.today += 1;
    else if (b === "Tomorrow") followUp.tomorrow += 1;
    else if (b === "This Week") followUp.thisWeek += 1;
    else followUp.later += 1;
  }

  const interested = scopedLeads.filter((l) => l.status === "Contacted (Interested)").length;
  const total = scopedLeads.length;
  const conversion = { total, interested, rate: total === 0 ? 0 : Math.round((interested / total) * 100) };

  const invoiceMetrics = { unpaid: 0, partiallyPaid: 0, paid: 0, total: 0 };
  for (const i of scopedInvoices) {
    invoiceMetrics.total += i.total;
    if (i.plainStatus === "Unpaid") invoiceMetrics.unpaid += 1;
    else if (i.plainStatus === "Partially Paid") invoiceMetrics.partiallyPaid += 1;
    else invoiceMetrics.paid += 1;
  }

  const scopedCommissions = filters.country
    ? commissions.filter((c) => (c as { country?: string }).country === filters.country)
    : commissions;

  return {
    pipeline,
    leadSources,
    team,
    followUp,
    conversion,
    invoices: invoiceMetrics,
    commissions: commissionSummary(scopedCommissions, now),
  };
}
