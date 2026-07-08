import "server-only";

import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import type { RCommission, RCustomer, RInvoice, RReceipt } from "@/lib/regional/reseller-list";
import { resolveRegionalCountries, scopeByCountry } from "@/lib/regional/regional-scope";
import type { PortalLead } from "@/lib/ui-data";
import { getUiCommissionEntries, getUiLeads, getUiRows } from "@/lib/ui-data";

export interface RegionalScopedData {
  effective: string[];
  scopeLabel: string;
  leads: PortalLead[];
  invoices: RInvoice[];
  receipts: RReceipt[];
  commissions: RCommission[];
  customers: RCustomer[];
}

/** Gather the director's country-scoped records, narrowed by the `?country=` selector. */
export async function regionalScopedData(session: PortalSession, country?: string): Promise<RegionalScopedData> {
  const assigned = session.effectiveUser.countries as readonly string[];
  const effective = resolveRegionalCountries(assigned, country);
  const store = getDevStore();

  const [leadsResult, invoicesResult, receiptsResult, commissionsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiCommissionEntries(session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  const inScope = (c: unknown) => effective.includes(String(c));

  return {
    effective,
    scopeLabel: country && effective.length === 1 ? effective[0] : `All my countries (${assigned.join(", ")})`,
    leads: scopeByCountry(leadsResult.data, effective),
    invoices: invoicesResult.data.filter((i) => inScope(i.country)).map((i) => ({
      reseller: String(i.reseller ?? ""), country: String(i.country ?? ""), total: Number(i.total ?? 0), paymentStatus: String(i.paymentStatus ?? ""),
    })),
    receipts: receiptsResult.data.filter((r) => inScope(r.country)).map((r) => ({
      reseller: String(r.reseller ?? ""), country: String(r.country ?? ""), amount: Number(r.amount ?? 0),
    })),
    commissions: commissionsResult.data.filter((c) => inScope(c.country)).map((c) => ({
      reseller: String(c.reseller ?? ""), status: String(c.status ?? ""), commissionAmount: Number(c.commissionAmount ?? 0),
    })),
    customers: customersResult.data.filter((c) => inScope(c.country)).map((c) => ({
      reseller: String(c.reseller ?? ""), country: String(c.country ?? ""),
    })),
  };
}
