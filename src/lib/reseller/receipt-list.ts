/**
 * Reseller receipts list (spec §20). Pure + unit-testable filtering over the
 * already reseller-scoped receipts. Receipts are read-only here — they are
 * created from an invoice's "Record a payment" flow (slice 9b).
 */

export interface ReceiptRow {
  id: string;
  receiptNumber: string;
  invoice: string;
  customer: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentReference: string;
  issuedBy: string;
  issuedAt: string;
  pdfUrl: string;
}

export interface ReceiptFilters { search?: string; method?: string }

export function filterReceipts(receipts: readonly ReceiptRow[], filters: ReceiptFilters): ReceiptRow[] {
  const q = filters.search?.trim().toLowerCase() ?? "";
  return receipts.filter((r) => {
    if (filters.method && r.paymentMethod !== filters.method) return false;
    if (q) {
      const hay = `${r.receiptNumber} ${r.customer} ${r.invoice} ${r.paymentReference}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Sum of receipt amounts (assumes a single reseller currency in practice). */
export function receiptsTotal(receipts: readonly ReceiptRow[]): number {
  return receipts.reduce((s, r) => s + r.amount, 0);
}
