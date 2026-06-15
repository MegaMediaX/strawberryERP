import {
  invoiceRowsFor,
  type InvoiceLike,
  type InvoiceRow,
  type ReceiptLike,
} from "@/lib/reseller/invoice-payment-state";

/**
 * Regional invoices + receipts monitoring (spec §19/§20). Pure + unit-testable.
 * Reuses the tested reseller `invoicePaymentState` (amount paid / remaining /
 * plain status) and layers the §19 "Overdue" business label + payment-progress
 * percentage on top. Receipts are read-only — only filtering is needed. `now`
 * is injected for deterministic overdue tests.
 */

export type InvoiceBusinessStatus = "Paid" | "Partially Paid" | "Unpaid" | "Overdue";

export interface RegionalInvoiceLike extends InvoiceLike {
  createdBy: string;
}

export interface RegionalInvoiceRow extends InvoiceRow {
  createdBy: string;
  businessStatus: InvoiceBusinessStatus;
  /** 0–100, share of the invoice total that has been paid. */
  progress: number;
  overdue: boolean;
}

export function regionalInvoiceRows(
  invoices: readonly RegionalInvoiceLike[],
  receipts: readonly ReceiptLike[],
  now: Date,
): RegionalInvoiceRow[] {
  return invoiceRowsFor(invoices, receipts).map((row, idx) => {
    const overdue = row.plainStatus !== "Paid" && !!invoices[idx].dueDate && new Date(invoices[idx].dueDate!) < now;
    const businessStatus: InvoiceBusinessStatus = overdue ? "Overdue" : row.plainStatus;
    const progress = row.total > 0 ? Math.min(100, Math.round((row.amountPaid / row.total) * 100)) : 0;
    return { ...row, createdBy: invoices[idx].createdBy, businessStatus, progress, overdue };
  });
}

export interface RegionalInvoiceFilters {
  search?: string;
  country?: string;
  reseller?: string;
  status?: InvoiceBusinessStatus;
  currency?: string;
  overdueOnly?: boolean;
}

export function filterInvoices(
  rows: readonly RegionalInvoiceRow[],
  f: RegionalInvoiceFilters,
): RegionalInvoiceRow[] {
  const q = f.search?.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.invoiceNumber.toLowerCase().includes(q) && !r.customer.toLowerCase().includes(q)) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.reseller && r.reseller !== f.reseller) return false;
    if (f.status && r.businessStatus !== f.status) return false;
    if (f.currency && r.currency !== f.currency) return false;
    if (f.overdueOnly && !r.overdue) return false;
    return true;
  });
}

/** Count of invoices needing collection attention (the §19 monitoring focus). */
export function overdueInvoiceCount(rows: readonly RegionalInvoiceRow[]): number {
  return rows.filter((r) => r.overdue).length;
}

// ── Receipts (§20) — read-only list, filter only ──────────────────────────

export interface RegionalReceiptRow {
  id: string;
  receiptNumber: string;
  invoice: string;
  customer: string;
  country: string;
  reseller: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  issuedBy: string;
  issuedAt: string;
}

export interface RegionalReceiptFilters {
  search?: string;
  country?: string;
  reseller?: string;
  paymentMethod?: string;
  currency?: string;
}

export function filterReceipts(
  rows: readonly RegionalReceiptRow[],
  f: RegionalReceiptFilters,
): RegionalReceiptRow[] {
  const q = f.search?.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.receiptNumber.toLowerCase().includes(q) && !r.customer.toLowerCase().includes(q) && !r.invoice.toLowerCase().includes(q)) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.reseller && r.reseller !== f.reseller) return false;
    if (f.paymentMethod && r.paymentMethod !== f.paymentMethod) return false;
    if (f.currency && r.currency !== f.currency) return false;
    return true;
  });
}
