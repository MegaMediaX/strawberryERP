import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";
import type { RCommission, RInvoice, RReceipt } from "@/lib/regional/reseller-list";

/**
 * Regional reports (spec §23). Pure + unit-testable, visual-first (CSS bars in
 * the view — no chart library). Read-only monitor: country performance, lead
 * conversion funnel, and revenue & receipts — all derived from the already
 * country-scoped records. Reseller performance reuses `regionalResellers`.
 * `now` is injected for deterministic follow-up bucketing.
 */

const INTERESTED = "Contacted (Interested)";
const NOT_INTERESTED = "Contacted (Not Interested)";

// Lead-conversion funnel stages (ordered) → matching status string.
const FUNNEL: { label: string; status: string }[] = [
  { label: "New", status: "New Lead (Uncontacted)" },
  { label: "Attempted", status: "Attempted Contact (No Response)" },
  { label: "Awaiting", status: "Contacted (Awaiting Response)" },
  { label: "Interested", status: INTERESTED },
  { label: "Scheduled", status: "Scheduled Follow-Up" },
];

export interface CountryPerformanceRow {
  country: string;
  leads: number;
  interested: number;
  conversionRate: number; // %
  revenue: number;
  pendingInvoices: number;
  overdue: number;
  commissionPending: number;
}

export function countryPerformance(
  leads: readonly PortalLead[],
  invoices: readonly RInvoice[],
  receipts: readonly RReceipt[],
  commissions: readonly (RCommission & { country?: string })[],
  now: Date,
): CountryPerformanceRow[] {
  const countries = [...new Set([
    ...leads.map((l) => l.country),
    ...invoices.map((i) => i.country),
    ...receipts.map((r) => r.country),
  ].filter(Boolean))];

  return countries
    .map((country) => {
      const myLeads = leads.filter((l) => l.country === country);
      const interested = myLeads.filter((l) => l.status === INTERESTED).length;
      return {
        country,
        leads: myLeads.length,
        interested,
        conversionRate: myLeads.length === 0 ? 0 : Math.round((interested / myLeads.length) * 100),
        revenue: receipts.filter((r) => r.country === country).reduce((s, r) => s + r.amount, 0),
        pendingInvoices: invoices.filter((i) => i.country === country && i.paymentStatus !== "Fully Paid").length,
        overdue: myLeads.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue").length,
        commissionPending: commissions.filter((c) => c.country === country && c.status === "Pending").reduce((s, c) => s + c.commissionAmount, 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || a.country.localeCompare(b.country));
}

export interface FunnelStage { label: string; count: number }

export interface LeadConversionReport {
  stages: FunnelStage[];
  total: number;
  interested: number;
  conversionRate: number; // interested / total %
  notInterested: number;
}

export function leadConversionFunnel(leads: readonly PortalLead[]): LeadConversionReport {
  const stages = FUNNEL.map((f) => ({ label: f.label, count: leads.filter((l) => l.status === f.status).length }));
  const interested = leads.filter((l) => l.status === INTERESTED).length;
  return {
    stages,
    total: leads.length,
    interested,
    conversionRate: leads.length === 0 ? 0 : Math.round((interested / leads.length) * 100),
    notInterested: leads.filter((l) => l.status === NOT_INTERESTED).length,
  };
}

export interface RevenueBreakdownRow { key: string; revenue: number; invoiced: number; pending: number }

export interface RevenueReceiptsReport {
  invoiceTotal: number;
  receiptTotal: number;
  paidInvoices: number;
  unpaidInvoices: number;
  byCountry: RevenueBreakdownRow[];
  byReseller: RevenueBreakdownRow[];
}

function breakdown(
  keys: readonly string[],
  invoices: readonly RInvoice[],
  receipts: readonly RReceipt[],
  keyOf: (r: { country: string; reseller: string }) => string,
): RevenueBreakdownRow[] {
  return keys
    .map((key) => ({
      key,
      revenue: receipts.filter((r) => keyOf(r as never) === key).reduce((s, r) => s + r.amount, 0),
      invoiced: invoices.filter((i) => keyOf(i as never) === key).reduce((s, i) => s + i.total, 0),
      pending: invoices.filter((i) => keyOf(i as never) === key && i.paymentStatus !== "Fully Paid").reduce((s, i) => s + i.total, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key));
}

export function revenueReceipts(
  invoices: readonly RInvoice[],
  receipts: readonly RReceipt[],
): RevenueReceiptsReport {
  const countries = [...new Set([...invoices.map((i) => i.country), ...receipts.map((r) => r.country)].filter(Boolean))];
  const resellers = [...new Set([...invoices.map((i) => i.reseller), ...receipts.map((r) => r.reseller)].filter(Boolean))];
  return {
    invoiceTotal: invoices.reduce((s, i) => s + i.total, 0),
    receiptTotal: receipts.reduce((s, r) => s + r.amount, 0),
    paidInvoices: invoices.filter((i) => i.paymentStatus === "Fully Paid").length,
    unpaidInvoices: invoices.filter((i) => i.paymentStatus !== "Fully Paid").length,
    byCountry: breakdown(countries, invoices, receipts, (r) => r.country),
    byReseller: breakdown(resellers, invoices, receipts, (r) => r.reseller),
  };
}
