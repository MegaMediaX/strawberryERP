import { invoiceOverdue } from "@/lib/admin/dashboard";
import { previewInvoiceNumber } from "@/lib/admin/countries";

/**
 * Super Admin accounting center (spec §17/§18/§20). Pure + unit-testable. The
 * overview tiles, the invoice-numbering preview (Global INV-0001 vs country
 * LB-INV-0001), and the currency usage count that drives the "disabling a used
 * currency" warning. Persistence + per-field validation reuse the tested
 * billing-settings / payment-methods libs.
 */

export interface AcctInvoice { paymentStatus: string; total: number; dueDate: string; currency: string }

export interface AccountingOverview {
  pendingInvoices: number;
  overdueInvoices: number;
  unpaidBalance: number;
  activePaymentMethods: number;
  activeCurrencies: number;
}

export function accountingOverview(
  invoices: readonly AcctInvoice[],
  paymentMethods: readonly { isActive: boolean }[],
  currencies: readonly { isActive: boolean }[],
  now: Date,
): AccountingOverview {
  const unpaid = invoices.filter((i) => i.paymentStatus !== "Fully Paid" && i.paymentStatus !== "Cancelled");
  return {
    pendingInvoices: unpaid.length,
    overdueInvoices: invoices.filter((i) => invoiceOverdue(i, now)).length,
    unpaidBalance: unpaid.reduce((s, i) => s + i.total, 0),
    activePaymentMethods: paymentMethods.filter((m) => m.isActive).length,
    activeCurrencies: currencies.filter((c) => c.isActive).length,
  };
}

/** How many invoices use a currency (drives the §20 disable warning). */
export function currencyUsageCount(code: string, invoices: readonly { currency: string }[]): number {
  return invoices.filter((i) => i.currency === code).length;
}

export interface InvoicingPreview { mode: string; example: string }

/** §18 live invoice-number preview for a numbering mode + prefixes. */
export function invoicingPreview(mode: string, globalPrefix: string, sampleCountryPrefix: string): InvoicingPreview {
  if (mode === "Country Prefix") {
    return { mode, example: previewInvoiceNumber(sampleCountryPrefix || "LB-INV") };
  }
  return { mode, example: previewInvoiceNumber(globalPrefix || "INV") };
}
