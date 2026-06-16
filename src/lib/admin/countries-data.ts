import "server-only";

import { getCountries, getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import type { CountryRecord } from "@/lib/admin/countries";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export interface AdminCountryRow extends CountryRecord {
  activeResellers: number;
  leads: number;
  customers: number;
  revenue: number;
}

/** Merge configured countries (§9) with their GLOBAL platform metrics. */
export async function adminCountriesData(session: PortalSession): Promise<AdminCountryRow[]> {
  const store = getDevStore();
  const [leadsResult, receiptsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  const leads = leadsResult.data;
  const receipts = receiptsResult.data.map((r) => ({ country: String(r.country ?? ""), reseller: String(r.reseller ?? ""), amount: Number(r.amount ?? 0) }));
  const customers = customersResult.data.map((c) => ({ country: String(c.country ?? "") }));

  return getCountries().map((c) => {
    const inCountry = (x: { country: string }) => x.country === c.name;
    return {
      ...c,
      activeResellers: new Set(leads.filter((l) => l.country === c.name).map((l) => l.reseller).filter(Boolean)).size,
      leads: leads.filter((l) => l.country === c.name).length,
      customers: customers.filter(inCountry).length,
      revenue: receipts.filter(inCountry).reduce((s, r) => s + r.amount, 0),
    };
  });
}

/** Read a single country record by name (case-insensitive) for the edit form. */
export function adminCountryByName(name: string): CountryRecord | undefined {
  return getCountries().find((c) => c.name.toLowerCase() === decodeURIComponent(name).toLowerCase());
}
