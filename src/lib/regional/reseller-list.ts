import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Regional reseller comparison (spec §12) + reseller regional profile (§13).
 * Pure + unit-testable. Inputs are ALREADY country-scoped (assigned countries,
 * narrowed by the country selector). The director monitors/compares only — no
 * mutation. `now` injected for deterministic overdue bucketing.
 */

export interface RInvoice { reseller: string; country: string; total: number; paymentStatus: string }
export interface RReceipt { reseller: string; country: string; amount: number }
export interface RCommission { reseller: string; status: string; commissionAmount: number }
export interface RCustomer { reseller: string; country: string }

export type ResellerStatus = "Active" | "At risk" | "Pending payment";

export interface ResellerRow {
  reseller: string;
  countries: string[];
  activeLeads: number;
  interestedLeads: number;
  customers: number;
  revenue: number;
  pendingInvoices: number;
  overdue: number;
  commissionPending: number;
  status: ResellerStatus;
}

const INTERESTED = "Contacted (Interested)";
const NOT_INTERESTED = "Contacted (Not Interested)";

const STAGE_LABEL: Record<string, string> = {
  "New Lead (Uncontacted)": "New",
  "Attempted Contact (No Response)": "Attempted",
  "Contacted (Awaiting Response)": "Awaiting",
  "Contacted (Not Interested)": "Not interested",
  "Contacted (Interested)": "Interested",
  "Scheduled Follow-Up": "Scheduled",
};

function resellerStatus(overdue: number, pendingInvoices: number): ResellerStatus {
  if (overdue > 0) return "At risk";
  if (pendingInvoices > 0) return "Pending payment";
  return "Active";
}

export function regionalResellers(
  leads: readonly PortalLead[],
  invoices: readonly RInvoice[],
  receipts: readonly RReceipt[],
  commissions: readonly RCommission[],
  customers: readonly RCustomer[],
  now: Date,
): ResellerRow[] {
  const names = new Set<string>([
    ...leads.map((l) => l.reseller),
    ...invoices.map((i) => i.reseller),
    ...customers.map((c) => c.reseller),
    ...receipts.map((r) => r.reseller),
  ].filter(Boolean));

  const rows = [...names].map((reseller) => {
    const myLeads = leads.filter((l) => l.reseller === reseller);
    const overdue = myLeads.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue").length;
    const pendingInvoices = invoices.filter((i) => i.reseller === reseller && i.paymentStatus !== "Fully Paid").length;
    return {
      reseller,
      countries: [...new Set(myLeads.map((l) => l.country))].sort(),
      activeLeads: myLeads.filter((l) => l.status !== NOT_INTERESTED).length,
      interestedLeads: myLeads.filter((l) => l.status === INTERESTED).length,
      customers: customers.filter((c) => c.reseller === reseller).length,
      revenue: receipts.filter((r) => r.reseller === reseller).reduce((s, r) => s + r.amount, 0),
      pendingInvoices,
      overdue,
      commissionPending: commissions.filter((c) => c.reseller === reseller && c.status === "Pending").reduce((s, c) => s + c.commissionAmount, 0),
      status: resellerStatus(overdue, pendingInvoices),
    };
  });
  return rows.sort((a, b) => b.revenue - a.revenue || b.activeLeads - a.activeLeads || a.reseller.localeCompare(b.reseller));
}

export interface ResellerListFilters { status?: string; overdueOnly?: boolean }

export function filterResellerRows(rows: readonly ResellerRow[], filters: ResellerListFilters): ResellerRow[] {
  return rows.filter((r) => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.overdueOnly && r.overdue <= 0) return false;
    return true;
  });
}

// ---- §13 Reseller Regional Profile aggregates ----

export interface CountryBreakdownRow { country: string; leads: number; interested: number; customers: number; revenue: number; pendingInvoices: number }
export interface TeamActivityRow { assignee: string; leads: number; interested: number; overdue: number }
export interface ProfileStage { label: string; count: number }

export interface ResellerProfile {
  summary: { activeLeads: number; interested: number; customers: number; revenue: number; pendingInvoices: number; overdue: number; commissionPending: number };
  countryBreakdown: CountryBreakdownRow[];
  pipeline: ProfileStage[];
  teamActivity: TeamActivityRow[];
}

export function resellerRegionalProfile(
  reseller: string,
  leads: readonly PortalLead[],
  invoices: readonly RInvoice[],
  receipts: readonly RReceipt[],
  commissions: readonly RCommission[],
  customers: readonly RCustomer[],
  now: Date,
): ResellerProfile {
  const row = regionalResellers(leads, invoices, receipts, commissions, customers, now).find((r) => r.reseller === reseller)
    ?? { activeLeads: 0, interestedLeads: 0, customers: 0, revenue: 0, pendingInvoices: 0, overdue: 0, commissionPending: 0 };
  const myLeads = leads.filter((l) => l.reseller === reseller);

  const countries = [...new Set([
    ...myLeads.map((l) => l.country),
    ...customers.filter((c) => c.reseller === reseller).map((c) => c.country),
    ...invoices.filter((i) => i.reseller === reseller).map((i) => i.country),
  ])].sort();
  const countryBreakdown: CountryBreakdownRow[] = countries.map((country) => ({
    country,
    leads: myLeads.filter((l) => l.country === country).length,
    interested: myLeads.filter((l) => l.country === country && l.status === INTERESTED).length,
    customers: customers.filter((c) => c.reseller === reseller && c.country === country).length,
    revenue: receipts.filter((r) => r.reseller === reseller && r.country === country).reduce((s, r) => s + r.amount, 0),
    pendingInvoices: invoices.filter((i) => i.reseller === reseller && i.country === country && i.paymentStatus !== "Fully Paid").length,
  }));

  const statusCount = new Map<string, number>();
  for (const l of myLeads) statusCount.set(l.status, (statusCount.get(l.status) ?? 0) + 1);
  const pipeline: ProfileStage[] = leadStatuses.map((s) => ({ label: STAGE_LABEL[s] ?? s, count: statusCount.get(s) ?? 0 }));

  const assignees = [...new Set(myLeads.map((l) => l.assignedTo).filter(Boolean))].sort();
  const teamActivity: TeamActivityRow[] = assignees.map((assignee) => {
    const theirs = myLeads.filter((l) => l.assignedTo === assignee);
    return {
      assignee,
      leads: theirs.length,
      interested: theirs.filter((l) => l.status === INTERESTED).length,
      overdue: theirs.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue").length,
    };
  });

  return {
    summary: {
      activeLeads: "activeLeads" in row ? row.activeLeads : 0,
      interested: "interestedLeads" in row ? row.interestedLeads : 0,
      customers: row.customers,
      revenue: row.revenue,
      pendingInvoices: row.pendingInvoices,
      overdue: row.overdue,
      commissionPending: row.commissionPending,
    },
    countryBreakdown,
    pipeline,
    teamActivity,
  };
}
