import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Super Admin dashboard aggregates (spec §5/§6/§7/§8). Pure + unit-testable,
 * GLOBAL (unscoped — all countries/resellers). Reuses the same conventions as
 * the regional dashboard (interested = "Contacted (Interested)", overdue via
 * bucketFollowUp). `now` is injected for determinism. Visual-first cards in the
 * view; no chart library.
 */

const INTERESTED = "Contacted (Interested)";

export interface DashInvoice { country: string; reseller: string; paymentStatus: string; dueDate: string }
export interface DashReceipt { amount: number; issuedAt: string }
export interface DashContract { contractStatus: "Not Signed" | "Signed" }
export interface DashDeleteItem { status: string }
export interface DashApiLog { apiKey: string; endpoint: string; statusCode: number }
export interface DashIntegration { integrationType: string; provider: string; isEnabled: boolean; connectionStatus: string }

/** An invoice is overdue when it isn't fully paid and its due date has passed. */
export function invoiceOverdue(inv: { paymentStatus: string; dueDate: string }, now: Date): boolean {
  if (inv.paymentStatus === "Fully Paid" || inv.paymentStatus === "Cancelled") return false;
  if (inv.paymentStatus === "Overdue") return true;
  return inv.dueDate ? new Date(inv.dueDate).getTime() < now.getTime() : false;
}

export interface AdminGlobalSummary {
  totalLeads: number;
  interested: number;
  customers: number;
  activeResellers: number;
  countries: number;
  revenueThisMonth: number;
  pendingInvoices: number;
  overdueFollowUps: number;
}

export function adminGlobalSummary(
  leads: readonly PortalLead[],
  invoices: readonly DashInvoice[],
  receipts: readonly DashReceipt[],
  customersCount: number,
  activeResellers: number,
  countries: number,
  now: Date,
): AdminGlobalSummary {
  const y = now.getFullYear();
  const m = now.getMonth();
  const revenueThisMonth = receipts
    .filter((r) => { const d = new Date(r.issuedAt); return d.getFullYear() === y && d.getMonth() === m; })
    .reduce((s, r) => s + r.amount, 0);
  return {
    totalLeads: leads.length,
    interested: leads.filter((l) => l.status === INTERESTED).length,
    customers: customersCount,
    activeResellers,
    countries,
    revenueThisMonth,
    pendingInvoices: invoices.filter((i) => i.paymentStatus !== "Fully Paid" && i.paymentStatus !== "Cancelled").length,
    overdueFollowUps: leads.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue").length,
  };
}

export interface TodayNeedsAttention {
  overdueInvoices: number;
  overdueFollowUps: number;
  unsignedContracts: number;
  deleteRequests: number;
  whatsappFailures: number;
  apiKeyErrors: number;
}

export function todayNeedsAttention(
  leads: readonly PortalLead[],
  invoices: readonly DashInvoice[],
  contracts: readonly DashContract[],
  deleteQueue: readonly DashDeleteItem[],
  apiLogs: readonly DashApiLog[],
  now: Date,
): TodayNeedsAttention {
  const failed = apiLogs.filter((l) => l.statusCode >= 400);
  return {
    overdueInvoices: invoices.filter((i) => invoiceOverdue(i, now)).length,
    overdueFollowUps: leads.filter((l) => bucketFollowUp(l.followUp, now) === "Overdue").length,
    unsignedContracts: contracts.filter((c) => c.contractStatus === "Not Signed").length,
    deleteRequests: deleteQueue.filter((d) => d.status === "Pending").length,
    whatsappFailures: failed.filter((l) => /whatsapp/i.test(l.endpoint)).length,
    apiKeyErrors: new Set(failed.map((l) => l.apiKey)).size,
  };
}

export interface IntegrationHealthRow {
  integrationType: string;
  provider: string;
  enabled: boolean;
  status: string;
  ok: boolean;
}

export function integrationHealth(settings: readonly DashIntegration[]): IntegrationHealthRow[] {
  return settings.map((s) => ({
    integrationType: s.integrationType,
    provider: s.provider,
    enabled: s.isEnabled,
    status: s.connectionStatus,
    ok: s.connectionStatus === "Connected",
  }));
}

export interface AdminBadgeCounts {
  deleteQueue: number;
  apiErrors: number;
  whatsappErrors: number;
  overdueInvoices: number;
  integrationErrors: number;
}

/** Urgent sidebar badge counts (§4) derived from global dev-store state. */
export function adminBadgeCounts(
  invoices: readonly DashInvoice[],
  deleteQueue: readonly DashDeleteItem[],
  apiLogs: readonly DashApiLog[],
  settings: readonly DashIntegration[],
  now: Date,
): AdminBadgeCounts {
  const failed = apiLogs.filter((l) => l.statusCode >= 400);
  return {
    deleteQueue: deleteQueue.filter((d) => d.status === "Pending").length,
    apiErrors: failed.length,
    whatsappErrors: failed.filter((l) => /whatsapp/i.test(l.endpoint)).length,
    overdueInvoices: invoices.filter((i) => invoiceOverdue(i, now)).length,
    integrationErrors: settings.filter((s) => s.connectionStatus === "Failed").length,
  };
}
