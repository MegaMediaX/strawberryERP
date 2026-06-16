import "server-only";

import { getCustomerOverrides, getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers, invoices as seedInvoices, receipts as seedReceipts } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import { regionalCustomerRows } from "@/lib/regional/customer-list";
import type { ContractLike, CustomerRollup, InvoiceLike, ReceiptLike } from "@/lib/reseller/customer-rollup";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export interface AdminCustomerData {
  rows: CustomerRollup[];
  phoneByCompany: Record<string, string>;
  notesById: Record<string, string[]>;
}

/** Gather GLOBAL customer rollups (§15) — all countries/resellers, archived removed. */
export async function adminCustomersData(session: PortalSession): Promise<AdminCustomerData> {
  const [customersResult, leadsResult] = await Promise.all([
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
    getUiLeads(session),
  ]);
  const overrides = getCustomerOverrides();

  const customers = customersResult.data
    .map((c) => ({ id: String(c.id), name: String(c.name), country: String(c.country), reseller: String(c.reseller) }))
    .filter((c) => !overrides[c.id]?.archived);

  const rows = regionalCustomerRows(
    customers,
    getDevStore().contracts as unknown as ContractLike[],
    seedInvoices as unknown as InvoiceLike[],
    seedReceipts as unknown as ReceiptLike[],
  );

  const phoneByCompany: Record<string, string> = {};
  for (const l of leadsResult.data) if (!phoneByCompany[l.company]) phoneByCompany[l.company] = l.phone;

  const notesById: Record<string, string[]> = {};
  for (const [id, o] of Object.entries(overrides)) if (o.notes?.length) notesById[id] = o.notes;

  return { rows, phoneByCompany, notesById };
}

export function adminCustomerById(id: string): CustomerRollup | undefined {
  const customer = seedCustomers.find((c) => c.id === decodeURIComponent(id));
  if (!customer || getCustomerOverrides()[customer.id]?.archived) return undefined;
  return regionalCustomerRows(
    [{ id: customer.id, name: customer.name, country: customer.country, reseller: customer.reseller }],
    getDevStore().contracts as unknown as ContractLike[],
    seedInvoices as unknown as InvoiceLike[],
    seedReceipts as unknown as ReceiptLike[],
  )[0];
}
