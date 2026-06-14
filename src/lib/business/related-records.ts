import type { PortalLead } from "@/lib/ui-data";

/**
 * Related billing records for a lead's company (spec §13 right panel). Pure +
 * unit-testable. Filters already-loaded invoices/receipts to the SAME customer
 * AND reseller as the lead — so a Reseller Admin only ever sees their own
 * reseller's billing, scoped to this company. Newest first.
 */

export interface RelatedInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  reseller: string;
  currency: string;
  total: number;
  paymentStatus: string;
  dueDate?: string;
}

export interface RelatedReceipt {
  id: string;
  receiptNumber: string;
  customer: string;
  reseller: string;
  currency: string;
  amount: number;
  paymentMethod: string;
  issuedAt?: string;
}

const sameScope = (r: { customer: string; reseller: string }, lead: PortalLead) =>
  r.customer === lead.company && r.reseller === lead.reseller;

export function relatedRecordsFor<
  I extends RelatedInvoice,
  R extends RelatedReceipt,
>(lead: PortalLead, invoices: readonly I[], receipts: readonly R[]): { invoices: I[]; receipts: R[] } {
  return {
    invoices: invoices
      .filter((i) => sameScope(i, lead))
      .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? "")),
    receipts: receipts
      .filter((r) => sameScope(r, lead))
      .sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? "")),
  };
}
