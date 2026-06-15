import "server-only";

import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import type { NotificationData } from "@/lib/reseller/reseller-notifications";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

/** Gather the reseller-scoped records the §26 notifications derive from. */
export async function resellerNotificationData(session: PortalSession): Promise<NotificationData> {
  const reseller = session.effectiveUser.reseller ?? "";
  const store = getDevStore();

  const [leadsResult, customersResult, invoicesResult, receiptsResult, commissionsResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("commissions", store.commissionEntries as unknown as Record<string, unknown>[], session),
  ]);

  const customerIdByName = Object.fromEntries(customersResult.data.map((c) => [String(c.name), String(c.id)]));

  return {
    leads: leadsResult.data,
    invoices: invoicesResult.data.map((i) => ({ id: String(i.id), invoiceNumber: String(i.invoiceNumber ?? i.id), customer: String(i.customer ?? ""), paymentStatus: String(i.paymentStatus ?? "") })),
    receipts: receiptsResult.data.map((r) => ({ id: String(r.id), receiptNumber: String(r.receiptNumber ?? r.id), invoice: String(r.invoice ?? ""), customer: String(r.customer ?? "") })),
    contracts: store.contracts.filter((c) => c.reseller === reseller).map((c) => ({ id: c.id, customer: c.customer, uploadedBy: c.uploadedBy, fileUrl: c.fileUrl })),
    commissions: commissionsResult.data.map((c) => ({ id: String(c.id), invoice: String(c.invoice ?? ""), status: String(c.status ?? ""), commissionAmount: Number(c.commissionAmount ?? 0) })),
    customerIdByName,
  };
}
