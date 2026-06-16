import "server-only";

import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import { brandingModeLabel, resellerCommissionLabel, resolveResellerAdmin } from "@/lib/admin/resellers";
import type { Reseller } from "@/lib/business/reseller-defaults";
import { regionalResellers } from "@/lib/regional/reseller-list";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export interface AdminResellerRow extends Reseller {
  adminName: string;
  adminUserId: string | null;
  activeUsers: number;
  leads: number;
  customers: number;
  revenue: number;
  overdue: number;
  commissionLabel: string;
  brandingMode: string;
}

/** Merge reseller records (§10) with GLOBAL metrics + admin-user resolution. */
export async function adminResellersData(session: PortalSession): Promise<AdminResellerRow[]> {
  const store = getDevStore();
  const [leadsResult, invoicesResult, receiptsResult, commissionsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("commissions", store.commissionEntries as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  const leads = leadsResult.data;
  const invoices = invoicesResult.data.map((i) => ({ reseller: String(i.reseller ?? ""), country: String(i.country ?? ""), total: Number(i.total ?? 0), paymentStatus: String(i.paymentStatus ?? "") }));
  const receipts = receiptsResult.data.map((r) => ({ reseller: String(r.reseller ?? ""), country: String(r.country ?? ""), amount: Number(r.amount ?? 0) }));
  const commissions = commissionsResult.data.map((c) => ({ reseller: String(c.reseller ?? ""), status: String(c.status ?? ""), commissionAmount: Number(c.commissionAmount ?? 0) }));
  const customers = customersResult.data.map((c) => ({ reseller: String(c.reseller ?? ""), country: String(c.country ?? "") }));
  const metrics = regionalResellers(leads, invoices, receipts, commissions, customers, new Date());
  const metricByName = new Map(metrics.map((m) => [m.reseller, m]));

  return store.resellerRecords.map((r) => {
    const m = metricByName.get(r.name);
    const admin = resolveResellerAdmin(store.users, r.name);
    return {
      ...r,
      adminName: admin?.name ?? "—",
      adminUserId: admin?.id ?? null,
      activeUsers: store.users.filter((u) => u.active && u.reseller === r.name).length,
      leads: m?.activeLeads ?? 0,
      customers: m?.customers ?? 0,
      revenue: m?.revenue ?? 0,
      overdue: m?.overdue ?? 0,
      commissionLabel: resellerCommissionLabel(r),
      brandingMode: brandingModeLabel(),
    };
  });
}

export function adminResellerByName(name: string): Reseller | undefined {
  return getDevStore().resellerRecords.find((r) => r.name.toLowerCase() === decodeURIComponent(name).toLowerCase());
}
