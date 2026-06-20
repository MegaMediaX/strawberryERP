import "server-only";

import { buildBillingRows } from "@/lib/billing/billing-rows";
import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import type { RegionalInvoiceRow, RegionalReceiptRow } from "@/lib/regional/billing-list";
import { resolveRegionalCountries } from "@/lib/regional/regional-scope";
import { getUiRows } from "@/lib/ui-data";

export interface RegionalBillingData {
  effective: string[];
  scopeLabel: string;
  invoices: RegionalInvoiceRow[];
  receipts: RegionalReceiptRow[];
  /** customer NAME → id, so an invoice/receipt row can link to the customer. */
  customerIdByName: Record<string, string>;
}

/** Gather the director's country-scoped invoices + receipts, narrowed by `?country=`. */
export async function regionalBillingData(session: PortalSession, country?: string): Promise<RegionalBillingData> {
  const assigned = session.effectiveUser.countries as readonly string[];
  const effective = resolveRegionalCountries(assigned, country);

  const [invoicesResult, receiptsResult, customersResult] = await Promise.all([
    getUiRows<Record<string, unknown>>("invoices", getDevStore().invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", getDevStore().receipts as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  const inScope = (c: unknown) => effective.includes(String(c));
  const { invoices, receipts } = buildBillingRows(invoicesResult.data, receiptsResult.data, new Date(), inScope);

  return {
    effective,
    scopeLabel: country && effective.length === 1 ? effective[0] : `All my countries (${assigned.join(", ")})`,
    invoices,
    receipts,
    customerIdByName: Object.fromEntries(customersResult.data.map((c) => [String(c.name), String(c.id)])),
  };
}
