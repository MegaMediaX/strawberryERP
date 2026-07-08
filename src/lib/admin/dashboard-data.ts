import "server-only";

import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import {
  adminBadgeCounts, adminGlobalSummary, integrationHealth, todayNeedsAttention,
  type AdminBadgeCounts, type AdminGlobalSummary, type IntegrationHealthRow, type TodayNeedsAttention,
} from "@/lib/admin/dashboard";
import { countryPerformance, type CountryPerformanceRow } from "@/lib/regional/regional-reports";
import { regionalResellers, type ResellerRow } from "@/lib/regional/reseller-list";
import type { ActivityTimelineEvent } from "@/lib/phase2-data";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export interface AdminDashboardData {
  summary: AdminGlobalSummary;
  today: TodayNeedsAttention;
  countries: CountryPerformanceRow[];
  resellers: ResellerRow[];
  integrations: IntegrationHealthRow[];
  recentAudit: ActivityTimelineEvent[];
  badges: AdminBadgeCounts;
  /** Backend errors surfaced by the five Promise.all fetches (deduped), so the view can warn instead of silently showing zeros. */
  errors: string[];
}

/** Gather GLOBAL (unscoped) platform data for the Super Admin dashboard (§5-§8). */
export async function adminDashboardData(session: PortalSession): Promise<AdminDashboardData> {
  const store = getDevStore();
  const now = new Date();

  const [leadsResult, invoicesResult, receiptsResult, commissionsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("commissions", store.commissionEntries as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  const leads = leadsResult.data;
  const invoices = invoicesResult.data.map((i) => ({ reseller: String(i.reseller ?? ""), country: String(i.country ?? ""), total: Number(i.total ?? 0), paymentStatus: String(i.paymentStatus ?? ""), dueDate: String(i.dueDate ?? "") }));
  const receipts = receiptsResult.data.map((r) => ({ reseller: String(r.reseller ?? ""), country: String(r.country ?? ""), amount: Number(r.amount ?? 0), issuedAt: String(r.issuedAt ?? r.createdAt ?? "") }));
  const commissions = commissionsResult.data.map((c) => ({ reseller: String(c.reseller ?? ""), country: String(c.country ?? ""), status: String(c.status ?? ""), commissionAmount: Number(c.commissionAmount ?? 0) }));
  const customers = customersResult.data.map((c) => ({ reseller: String(c.reseller ?? ""), country: String(c.country ?? "") }));

  // Widened to match the tables rendered below the KPI tiles: the reseller
  // leaderboard (regionalResellers) also counts customers + receipts; the
  // country table (countryPerformance) also counts receipts. Narrower KPI sets
  // made the tile and its own table disagree on the same screen.
  const activeResellers = new Set([...leads.map((l) => l.reseller), ...invoices.map((i) => i.reseller), ...customers.map((c) => c.reseller), ...receipts.map((r) => r.reseller)].filter(Boolean)).size;
  const countriesCount = new Set([...leads.map((l) => l.country), ...invoices.map((i) => i.country), ...receipts.map((r) => r.country)].filter(Boolean)).size;

  const errors = [...new Set(
    [leadsResult.error, invoicesResult.error, receiptsResult.error, commissionsResult.error, customersResult.error].filter((e): e is string => Boolean(e)),
  )];

  return {
    summary: adminGlobalSummary(leads, invoices, receipts, customers.length, activeResellers, countriesCount, now),
    today: todayNeedsAttention(leads, invoices, store.contracts, store.deleteQueue, store.apiLogs, now),
    countries: countryPerformance(leads, invoices, receipts, commissions, now),
    resellers: regionalResellers(leads, invoices, receipts, commissions, customers, now),
    integrations: integrationHealth(store.integrationSettings),
    recentAudit: [...store.activityTimeline].slice(0, 8),
    badges: adminBadgeCounts(invoices, store.deleteQueue, store.apiLogs, store.integrationSettings, now),
    errors,
  };
}

/** Lightweight badge-only gather for the shared /admin layout (§4 sidebar). */
export async function adminBadgeData(): Promise<AdminBadgeCounts> {
  const store = getDevStore();
  return adminBadgeCounts(
    store.invoices.map((i) => ({ country: i.country, reseller: i.reseller, paymentStatus: i.paymentStatus, dueDate: i.dueDate })),
    store.deleteQueue,
    store.apiLogs,
    store.integrationSettings,
    new Date(),
  );
}
