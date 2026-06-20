import "server-only";

import { buildBillingRows } from "@/lib/billing/billing-rows";
import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import type { RegionalInvoiceRow, RegionalReceiptRow } from "@/lib/regional/billing-list";
import { getUiRows } from "@/lib/ui-data";

/**
 * Super Admin GLOBAL billing data (admin invoices + receipts). FULL ACCESS — no
 * country/reseller scoping. Row mapping + payment-state derivation is shared with
 * the regional path via `buildBillingRows`.
 */
export interface AdminBillingData {
  invoices: RegionalInvoiceRow[];
  receipts: RegionalReceiptRow[];
  customerIdByName: Record<string, string>;
}

export async function adminBillingData(session: PortalSession): Promise<AdminBillingData> {
  const store = getDevStore();
  const [invoicesResult, receiptsResult] = await Promise.all([
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
  ]);

  const { invoices, receipts } = buildBillingRows(invoicesResult.data, receiptsResult.data, new Date());

  const customerIdByName: Record<string, string> = {};
  for (const c of seedCustomers) customerIdByName[c.name] = c.id;

  return { invoices, receipts, customerIdByName };
}
