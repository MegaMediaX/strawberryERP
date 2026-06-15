import "server-only";

import { getDevStore } from "@/lib/dev-store";
import type { PortalSession } from "@/lib/portal-security";
import { regionalBillingData } from "@/lib/regional/billing-data";
import { regionalCustomerData } from "@/lib/regional/customer-data";
import { regionalResellers } from "@/lib/regional/reseller-list";
import { regionalScopedData } from "@/lib/regional/scoped-data";
import type { RegionalSearchData } from "@/lib/regional/regional-search";

/** Gather all of the director's country-scoped records for §24 global search. */
export async function regionalSearchData(session: PortalSession, country?: string): Promise<{ data: RegionalSearchData; scopeLabel: string }> {
  const [scoped, billing, customers] = await Promise.all([
    regionalScopedData(session, country),
    regionalBillingData(session, country),
    regionalCustomerData(session, country),
  ]);

  const resellers = regionalResellers(scoped.leads, scoped.invoices, scoped.receipts, [], scoped.customers, new Date())
    .map((r) => ({ id: r.reseller, name: r.reseller, countries: r.countries }));

  const contracts = getDevStore().contracts
    .filter((c) => scoped.effective.includes(c.country))
    .map((c) => ({ id: c.id, customer: c.customer, country: c.country, reseller: c.reseller, contractStatus: c.contractStatus }));

  return {
    scopeLabel: scoped.scopeLabel,
    data: {
      leads: scoped.leads,
      customers: customers.rows.map((c) => ({ id: c.id, name: c.name, country: c.country, reseller: c.reseller })),
      invoices: billing.invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, customer: i.customer, country: i.country, reseller: i.reseller, total: i.total, currency: i.currency })),
      receipts: billing.receipts.map((r) => ({ id: r.id, receiptNumber: r.receiptNumber, customer: r.customer, country: r.country, reseller: r.reseller, amount: r.amount, currency: r.currency })),
      resellers,
      contracts,
    },
  };
}
