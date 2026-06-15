import "server-only";

import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import {
  regionalInvoiceRows,
  type RegionalInvoiceLike,
  type RegionalInvoiceRow,
  type RegionalReceiptRow,
} from "@/lib/regional/billing-list";
import { resolveRegionalCountries } from "@/lib/regional/regional-scope";
import type { ReceiptLike } from "@/lib/reseller/invoice-payment-state";
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

  const invoiceInputs: RegionalInvoiceLike[] = invoicesResult.data
    .filter((i) => inScope(i.country))
    .map((i) => ({
      id: String(i.id),
      invoiceNumber: String(i.invoiceNumber ?? i.id),
      customer: String(i.customer ?? ""),
      country: String(i.country ?? ""),
      reseller: String(i.reseller ?? ""),
      currency: String(i.currency ?? ""),
      total: Number(i.total ?? 0),
      dueDate: i.dueDate ? String(i.dueDate) : undefined,
      createdBy: String(i.createdByUser ?? "—"),
    }));

  // All in-scope receipts feed both the §20 list AND the §19 payment-state derivation.
  const receiptRows: RegionalReceiptRow[] = receiptsResult.data
    .filter((r) => inScope(r.country))
    .map((r) => ({
      id: String(r.id),
      receiptNumber: String(r.receiptNumber ?? r.id),
      invoice: String(r.invoice ?? ""),
      customer: String(r.customer ?? ""),
      country: String(r.country ?? ""),
      reseller: String(r.reseller ?? ""),
      amount: Number(r.amount ?? 0),
      currency: String(r.currency ?? ""),
      paymentMethod: String(r.paymentMethod ?? "—"),
      issuedBy: String(r.issuedBy ?? "—"),
      issuedAt: String(r.issuedAt ?? ""),
    }))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const receiptLikes: ReceiptLike[] = receiptRows.map((r) => ({ invoice: r.invoice, reseller: r.reseller, amount: r.amount, paymentMethod: r.paymentMethod }));

  return {
    effective,
    scopeLabel: country && effective.length === 1 ? effective[0] : `All my countries (${assigned.join(", ")})`,
    invoices: regionalInvoiceRows(invoiceInputs, receiptLikes, new Date()),
    receipts: receiptRows,
    customerIdByName: Object.fromEntries(customersResult.data.map((c) => [String(c.name), String(c.id)])),
  };
}
