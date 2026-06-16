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
import type { ReceiptLike } from "@/lib/reseller/invoice-payment-state";
import { getUiRows } from "@/lib/ui-data";

/**
 * Super Admin GLOBAL billing data (admin invoices + receipts). FULL ACCESS — no
 * country/reseller scoping. Reuses the tested `regionalInvoiceRows` payment-state
 * derivation + `RegionalReceiptRow` shape over every record.
 */
export interface AdminBillingData {
  invoices: RegionalInvoiceRow[];
  receipts: RegionalReceiptRow[];
  customerIdByName: Record<string, string>;
}

const str = (v: unknown) => String(v ?? "");
const num = (v: unknown) => Number(v ?? 0);

export async function adminBillingData(session: PortalSession): Promise<AdminBillingData> {
  const store = getDevStore();
  const [invoicesResult, receiptsResult] = await Promise.all([
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
  ]);

  const invoiceInputs: RegionalInvoiceLike[] = invoicesResult.data.map((i) => ({
    id: str(i.id), invoiceNumber: str(i.invoiceNumber ?? i.id), customer: str(i.customer),
    country: str(i.country), reseller: str(i.reseller), currency: str(i.currency),
    total: num(i.total), dueDate: i.dueDate ? str(i.dueDate) : undefined, createdBy: str(i.createdByUser ?? i.issuedBy ?? "—"),
  }));

  const receipts: RegionalReceiptRow[] = receiptsResult.data.map((r) => ({
    id: str(r.id), receiptNumber: str(r.receiptNumber ?? r.id), invoice: str(r.invoice), customer: str(r.customer),
    country: str(r.country), reseller: str(r.reseller), amount: num(r.amount), currency: str(r.currency),
    paymentMethod: str(r.paymentMethod ?? "—"), issuedBy: str(r.issuedBy ?? "—"), issuedAt: str(r.issuedAt ?? ""),
  })).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const receiptLikes: ReceiptLike[] = receipts.map((r) => ({ invoice: r.invoice, reseller: r.reseller, amount: r.amount, paymentMethod: r.paymentMethod }));

  const customerIdByName: Record<string, string> = {};
  for (const c of seedCustomers) customerIdByName[c.name] = c.id;

  return {
    invoices: regionalInvoiceRows(invoiceInputs, receiptLikes, new Date()),
    receipts,
    customerIdByName,
  };
}
