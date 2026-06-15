import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Regional Director dashboard metrics (spec §8/§9/§10/§11). Pure +
 * unit-testable. Inputs are ALREADY country-scoped (getUiLeads/getUiRows for the
 * director's assigned countries, then narrowed by the country selector), so this
 * just aggregates: regional KPI summary, reseller leaderboard, follow-up risk,
 * and the lead pipeline. `now` is injected for deterministic follow-up bucketing.
 */

export interface DashInvoice { reseller: string; paymentStatus: string }
export interface DashReceipt { reseller: string; amount: number; issuedAt: string }
export interface DashCustomer { reseller: string }

const INTERESTED = "Contacted (Interested)";

const STAGE_LABEL: Record<string, string> = {
  "New Lead (Uncontacted)": "New",
  "Attempted Contact (No Response)": "Attempted",
  "Contacted (Awaiting Response)": "Awaiting",
  "Contacted (Not Interested)": "Not interested",
  "Contacted (Interested)": "Interested",
  "Scheduled Follow-Up": "Scheduled",
};

export interface RegionalSummary {
  totalLeads: number;
  interested: number;
  customers: number;
  pendingInvoices: number;
  revenueThisMonth: number;
  conversionRate: number;
  overdueFollowUps: number;
}
export interface LeaderboardRow {
  reseller: string;
  leads: number;
  interested: number;
  customers: number;
  revenue: number;
  overdue: number;
}
export interface FollowUpRisk {
  overdue: number;
  vipOverdue: number;
  interestedOverdue: number;
  resellersWithOverdue: number;
}
export interface PipelineStage { label: string; count: number; percentage: number }

export interface RegionalDashboard {
  summary: RegionalSummary;
  leaderboard: LeaderboardRow[];
  followUpRisk: FollowUpRisk;
  pipeline: PipelineStage[];
}

function tally<T>(items: readonly T[], key: (i: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

export function regionalDashboard(
  leads: readonly PortalLead[],
  invoices: readonly DashInvoice[],
  receipts: readonly DashReceipt[],
  customers: readonly DashCustomer[],
  now: Date,
): RegionalDashboard {
  const overdue = (l: PortalLead) => bucketFollowUp(l.followUp, now) === "Overdue";
  const interestedLeads = leads.filter((l) => l.status === INTERESTED);
  const overdueLeads = leads.filter(overdue);

  const y = now.getFullYear();
  const m = now.getMonth();
  const revenueThisMonth = receipts
    .filter((r) => { const d = new Date(r.issuedAt); return d.getFullYear() === y && d.getMonth() === m; })
    .reduce((s, r) => s + r.amount, 0);

  const summary: RegionalSummary = {
    totalLeads: leads.length,
    interested: interestedLeads.length,
    customers: customers.length,
    pendingInvoices: invoices.filter((i) => i.paymentStatus !== "Fully Paid").length,
    revenueThisMonth,
    conversionRate: leads.length === 0 ? 0 : Math.round((interestedLeads.length / leads.length) * 100),
    overdueFollowUps: overdueLeads.length,
  };

  const followUpRisk: FollowUpRisk = {
    overdue: overdueLeads.length,
    vipOverdue: overdueLeads.filter((l) => l.priority === "VIP").length,
    interestedOverdue: overdueLeads.filter((l) => l.status === INTERESTED).length,
    resellersWithOverdue: new Set(overdueLeads.map((l) => l.reseller)).size,
  };

  // Leaderboard: every reseller appearing in the scoped data, ranked revenue→leads.
  const leadsByR = tally(leads, (l) => l.reseller);
  const intByR = tally(interestedLeads, (l) => l.reseller);
  const overdueByR = tally(overdueLeads, (l) => l.reseller);
  const custByR = tally(customers, (c) => c.reseller);
  const revByR = new Map<string, number>();
  for (const r of receipts) revByR.set(r.reseller, (revByR.get(r.reseller) ?? 0) + r.amount);

  const resellerNames = new Set<string>([
    ...leadsByR.keys(), ...custByR.keys(), ...revByR.keys(),
  ]);
  const leaderboard: LeaderboardRow[] = [...resellerNames]
    .map((reseller) => ({
      reseller,
      leads: leadsByR.get(reseller) ?? 0,
      interested: intByR.get(reseller) ?? 0,
      customers: custByR.get(reseller) ?? 0,
      revenue: revByR.get(reseller) ?? 0,
      overdue: overdueByR.get(reseller) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || a.reseller.localeCompare(b.reseller));

  const statusTally = tally(leads, (l) => l.status);
  const pipeline: PipelineStage[] = leadStatuses.map((s) => {
    const count = statusTally.get(s) ?? 0;
    return { label: STAGE_LABEL[s] ?? s, count, percentage: leads.length === 0 ? 0 : Math.round((count / leads.length) * 100) };
  });

  return { summary, leaderboard, followUpRisk, pipeline };
}
