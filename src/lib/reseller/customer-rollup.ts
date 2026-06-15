/**
 * Reseller customer rollup (spec §15/§16). Pure + unit-testable: derives each
 * customer's contract status, invoice status, outstanding balance, and a
 * progress stage from the related contracts / invoices / receipts (all linked
 * by customer NAME). Fields the customer record doesn't carry (contact,
 * assigned user, last activity) are surfaced as "—" by the UI, never faked.
 */

export interface CustomerLike { id: string; name: string; country: string; reseller: string }
export interface ContractLike { customer: string; reseller: string; contractStatus: "Not Signed" | "Signed" }
export interface InvoiceLike { customer: string; reseller: string; total: number }
export interface ReceiptLike { customer: string; reseller: string; amount: number }

export type CustomerProgress =
  | "Contract Not Signed" | "Contract Signed" | "Deposit Paid" | "Fully Paid";

export const PROGRESS_STAGES: CustomerProgress[] = [
  "Contract Not Signed", "Contract Signed", "Deposit Paid", "Fully Paid",
];

export interface CustomerRollup extends CustomerLike {
  contractStatus: "Not Signed" | "Signed";
  invoiceTotal: number;
  paidTotal: number;
  balance: number;
  invoiceStatus: "No invoices" | "Unpaid" | "Partially Paid" | "Fully Paid";
  progress: CustomerProgress;
}

export function customerRollup(
  customer: CustomerLike,
  contracts: readonly ContractLike[],
  invoices: readonly InvoiceLike[],
  receipts: readonly ReceiptLike[],
): CustomerRollup {
  const mineContract = contracts.find((c) => c.customer === customer.name && c.reseller === customer.reseller);
  const contractStatus = mineContract?.contractStatus ?? "Not Signed";

  const invoiceTotal = invoices
    .filter((i) => i.customer === customer.name && i.reseller === customer.reseller)
    .reduce((s, i) => s + i.total, 0);
  const paidTotal = receipts
    .filter((r) => r.customer === customer.name && r.reseller === customer.reseller)
    .reduce((s, r) => s + r.amount, 0);
  const balance = Math.max(0, invoiceTotal - paidTotal);

  const invoiceStatus: CustomerRollup["invoiceStatus"] =
    invoiceTotal === 0 ? "No invoices"
      : balance <= 0 ? "Fully Paid"
      : paidTotal > 0 ? "Partially Paid"
      : "Unpaid";

  let progress: CustomerProgress;
  if (contractStatus === "Not Signed") progress = "Contract Not Signed";
  else if (invoiceTotal > 0 && balance <= 0) progress = "Fully Paid";
  else if (paidTotal > 0) progress = "Deposit Paid";
  else progress = "Contract Signed";

  return { ...customer, contractStatus, invoiceTotal, paidTotal, balance, invoiceStatus, progress };
}

export function buildCustomerRows(
  customers: readonly CustomerLike[],
  contracts: readonly ContractLike[],
  invoices: readonly InvoiceLike[],
  receipts: readonly ReceiptLike[],
): CustomerRollup[] {
  return customers.map((c) => customerRollup(c, contracts, invoices, receipts));
}
