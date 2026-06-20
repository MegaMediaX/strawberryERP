import "server-only";

import {
  regionalInvoiceRows,
  type RegionalInvoiceLike,
  type RegionalInvoiceRow,
  type RegionalReceiptRow,
} from "@/lib/regional/billing-list";
import type { ReceiptLike } from "@/lib/reseller/invoice-payment-state";

/**
 * Shared billing-row builder for the admin (global) and regional (country-scoped)
 * billing data paths — previously duplicated field-by-field in admin/billing-data
 * and regional/billing-data (review #16). Maps raw invoice/receipt UI rows to the
 * derived `RegionalInvoiceRow`/`RegionalReceiptRow` shapes (payment-state + sorted
 * receipts). Pass `inScope` to filter by country; omit for full (admin) access.
 */

const str = (v: unknown) => String(v ?? "");
const num = (v: unknown) => Number(v ?? 0);

export function buildBillingRows(
  invoiceRows: readonly Record<string, unknown>[],
  receiptRows: readonly Record<string, unknown>[],
  now: Date,
  inScope?: (country: unknown) => boolean,
): { invoices: RegionalInvoiceRow[]; receipts: RegionalReceiptRow[] } {
  const filteredInvoices = inScope ? invoiceRows.filter((i) => inScope(i.country)) : invoiceRows;
  const filteredReceipts = inScope ? receiptRows.filter((r) => inScope(r.country)) : receiptRows;

  const invoiceInputs: RegionalInvoiceLike[] = filteredInvoices.map((i) => ({
    id: str(i.id), invoiceNumber: str(i.invoiceNumber ?? i.id), customer: str(i.customer),
    country: str(i.country), reseller: str(i.reseller), currency: str(i.currency),
    total: num(i.total), dueDate: i.dueDate ? str(i.dueDate) : undefined,
    createdBy: str(i.createdByUser ?? i.issuedBy ?? "—"),
  }));

  const receipts: RegionalReceiptRow[] = filteredReceipts
    .map((r) => ({
      id: str(r.id), receiptNumber: str(r.receiptNumber ?? r.id), invoice: str(r.invoice), customer: str(r.customer),
      country: str(r.country), reseller: str(r.reseller), amount: num(r.amount), currency: str(r.currency),
      paymentMethod: str(r.paymentMethod ?? "—"), issuedBy: str(r.issuedBy ?? "—"), issuedAt: str(r.issuedAt ?? ""),
    }))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const receiptLikes: ReceiptLike[] = receipts.map((r) => ({ invoice: r.invoice, reseller: r.reseller, amount: r.amount, paymentMethod: r.paymentMethod }));

  return { invoices: regionalInvoiceRows(invoiceInputs, receiptLikes, now), receipts };
}
