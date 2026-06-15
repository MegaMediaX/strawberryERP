import {
  buildCustomerRows,
  type ContractLike,
  type CustomerLike,
  type CustomerRollup,
  type InvoiceLike,
  type ReceiptLike,
} from "@/lib/reseller/customer-rollup";

/**
 * Regional customer monitoring (spec §17/§18). Pure + unit-testable. Reuses the
 * tested reseller `customerRollup` (contract/invoice status, balance, progress)
 * and layers the §17 regional filters on top. Every row already carries country
 * + reseller ownership. `now` is not needed — customers carry no follow-up date.
 */

export type RegionalCustomerFilters = {
  search?: string;
  country?: string;
  reseller?: string;
  contractStatus?: "Not Signed" | "Signed";
  invoiceStatus?: CustomerRollup["invoiceStatus"];
  progress?: CustomerRollup["progress"];
  /** §17 "Balance due" — only customers that still owe money. */
  balanceDue?: boolean;
  /** §17 "Fully paid" — progress reached Fully Paid. */
  fullyPaid?: boolean;
};

export function regionalCustomerRows(
  customers: readonly CustomerLike[],
  contracts: readonly ContractLike[],
  invoices: readonly InvoiceLike[],
  receipts: readonly ReceiptLike[],
): CustomerRollup[] {
  return buildCustomerRows(customers, contracts, invoices, receipts);
}

export function filterRegionalCustomers(
  rows: readonly CustomerRollup[],
  filters: RegionalCustomerFilters,
): CustomerRollup[] {
  const q = filters.search?.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (filters.country && r.country !== filters.country) return false;
    if (filters.reseller && r.reseller !== filters.reseller) return false;
    if (filters.contractStatus && r.contractStatus !== filters.contractStatus) return false;
    if (filters.invoiceStatus && r.invoiceStatus !== filters.invoiceStatus) return false;
    if (filters.progress && r.progress !== filters.progress) return false;
    if (filters.balanceDue && r.balance <= 0) return false;
    if (filters.fullyPaid && r.progress !== "Fully Paid") return false;
    return true;
  });
}

/** Count of customers "stuck" before any payment (the §17 monitoring focus). */
export function stuckCustomerCount(rows: readonly CustomerRollup[]): number {
  return rows.filter((r) => r.progress === "Contract Not Signed" || r.progress === "Contract Signed").length;
}
