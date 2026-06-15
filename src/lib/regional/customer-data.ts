import "server-only";

import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers, invoices as seedInvoices, receipts as seedReceipts } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import { regionalCustomerRows } from "@/lib/regional/customer-list";
import { resolveRegionalCountries } from "@/lib/regional/regional-scope";
import type { ContractLike, CustomerRollup, InvoiceLike, ReceiptLike } from "@/lib/reseller/customer-rollup";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export interface RegionalCustomerData {
  effective: string[];
  scopeLabel: string;
  rows: CustomerRollup[];
  /** WhatsApp phone resolved from the converted lead of the same company. */
  phoneByCompany: Record<string, string>;
}

/** Gather the director's country-scoped customer rollups, narrowed by `?country=`. */
export async function regionalCustomerData(session: PortalSession, country?: string): Promise<RegionalCustomerData> {
  const assigned = session.effectiveUser.countries as readonly string[];
  const effective = resolveRegionalCountries(assigned, country);

  const [customersResult, leadsResult] = await Promise.all([
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
    getUiLeads(session),
  ]);

  // getUiRows already country-scopes a Regional Director; narrow further by the selector.
  const customers = customersResult.data
    .map((c) => ({ id: String(c.id), name: String(c.name), country: String(c.country), reseller: String(c.reseller) }))
    .filter((c) => effective.includes(c.country));

  const rows = regionalCustomerRows(
    customers,
    getDevStore().contracts as unknown as ContractLike[],
    seedInvoices as unknown as InvoiceLike[],
    seedReceipts as unknown as ReceiptLike[],
  );

  const phoneByCompany: Record<string, string> = {};
  for (const l of leadsResult.data) {
    if (!phoneByCompany[l.company]) phoneByCompany[l.company] = l.phone;
  }

  return {
    effective,
    scopeLabel: country && effective.length === 1 ? effective[0] : `All my countries (${assigned.join(", ")})`,
    rows,
    phoneByCompany,
  };
}
