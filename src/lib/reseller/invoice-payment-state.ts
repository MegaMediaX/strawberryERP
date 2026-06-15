/**
 * Reseller invoice payment state (spec §18). Pure + unit-testable: matches each
 * invoice to its receipts (by invoice id, same reseller) and derives the amount
 * paid, remaining balance, and a plain-business payment status (no ERPNext
 * accounting jargon). Reused by the invoices list and, later, the detail page.
 */

export interface InvoiceLike {
  id: string;
  invoiceNumber: string;
  customer: string;
  country: string;
  reseller: string;
  currency: string;
  total: number;
  dueDate?: string;
}
export interface ReceiptLike { invoice: string; reseller: string; amount: number; paymentMethod: string }

export type PlainStatus = "Unpaid" | "Partially Paid" | "Paid";

export interface InvoiceRow extends InvoiceLike {
  amountPaid: number;
  remaining: number;
  plainStatus: PlainStatus;
  paymentMethod: string; // latest receipt's method, or "—"
}

export function invoicePaymentState(invoice: InvoiceLike, receipts: readonly ReceiptLike[]): InvoiceRow {
  const mine = receipts.filter((r) => r.invoice === invoice.id && r.reseller === invoice.reseller);
  const amountPaid = mine.reduce((s, r) => s + r.amount, 0);
  const remaining = Math.max(0, invoice.total - amountPaid);
  const plainStatus: PlainStatus =
    amountPaid <= 0 ? "Unpaid" : remaining <= 0 ? "Paid" : "Partially Paid";
  const paymentMethod = mine.length > 0 ? mine[mine.length - 1].paymentMethod : "—";
  return { ...invoice, amountPaid, remaining, plainStatus, paymentMethod };
}

export function invoiceRowsFor(
  invoices: readonly InvoiceLike[],
  receipts: readonly ReceiptLike[],
): InvoiceRow[] {
  return invoices.map((i) => invoicePaymentState(i, receipts));
}
