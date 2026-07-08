import "server-only";

import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import type { PortalSession } from "@/lib/portal-security";
import type { RCommission, RCustomer, RInvoice, RReceipt } from "@/lib/regional/reseller-list";
import type { AgendaEscalation, AgendaInvoice } from "@/lib/regional/build-regional-agenda";
import { escalationReasonLabel } from "@/lib/regional/escalation";
import type { PortalLead } from "@/lib/ui-data";
import { getUiCommissionEntries, getUiLeads, getUiRows } from "@/lib/ui-data";
import type { AdminSearchData } from "@/lib/admin/global-search";

/**
 * Super Admin GLOBAL data bundle (spec §34/§35/§36). FULL ACCESS — no country
 * or reseller scoping. `getUiLeads`/`getUiRows` already return every record for
 * a Super Admin session; we simply gather + reshape them for the tested
 * reports / calendar / search aggregators.
 */
export interface AdminGlobalData {
  leads: PortalLead[];
  invoices: RInvoice[];
  receipts: RReceipt[];
  commissions: (RCommission & { country: string })[];
  customers: RCustomer[];
  agendaInvoices: AgendaInvoice[];
  escalations: AgendaEscalation[];
}

const str = (v: unknown) => String(v ?? "");
const num = (v: unknown) => Number(v ?? 0);

export async function adminGlobalData(session: PortalSession): Promise<AdminGlobalData> {
  const store = getDevStore();
  const [leadsResult, invoicesResult, receiptsResult, commissionsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiCommissionEntries(session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  const invoices: RInvoice[] = invoicesResult.data.map((i) => ({
    reseller: str(i.reseller), country: str(i.country), total: num(i.total), paymentStatus: str(i.paymentStatus),
  }));
  const receipts: RReceipt[] = receiptsResult.data.map((r) => ({
    reseller: str(r.reseller), country: str(r.country), amount: num(r.amount),
  }));
  const commissions: (RCommission & { country: string })[] = commissionsResult.data.map((c) => ({
    reseller: str(c.reseller), status: str(c.status), commissionAmount: num(c.commissionAmount), country: str(c.country),
  }));
  const customers: RCustomer[] = customersResult.data.map((c) => ({ reseller: str(c.reseller), country: str(c.country) }));

  const agendaInvoices: AgendaInvoice[] = invoicesResult.data.map((i) => ({
    id: str(i.id), invoiceNumber: str(i.invoiceNumber ?? i.id), customer: str(i.customer),
    country: str(i.country), reseller: str(i.reseller), dueDate: i.dueDate ? str(i.dueDate) : undefined,
    amount: num(i.total), currency: str(i.currency), fullyPaid: str(i.paymentStatus) === "Fully Paid",
  }));

  const escalations: AgendaEscalation[] = store.escalations.map((e) => ({
    id: e.id, entityType: e.entityType, entityId: e.entityId, entityLabel: e.entityLabel,
    country: e.country, reseller: e.reseller, reasonLabel: escalationReasonLabel(e.reason), createdAt: e.createdAt,
  }));

  return {
    leads: leadsResult.data,
    invoices, receipts, commissions, customers,
    agendaInvoices, escalations,
  };
}

/** §36 global search dataset — every module a Super Admin can see. */
export async function adminSearchData(session: PortalSession): Promise<AdminSearchData> {
  const store = getDevStore();
  const [leadsResult, invoicesResult, receiptsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  return {
    leads: leadsResult.data.map((l) => ({ id: l.id, company: l.company, contact: l.contact, status: l.status, country: l.country, reseller: l.reseller })),
    customers: customersResult.data.map((c) => ({ id: str(c.id), name: str(c.name), country: str(c.country), reseller: str(c.reseller) })),
    invoices: invoicesResult.data.map((i) => ({ id: str(i.id), invoiceNumber: str(i.invoiceNumber ?? i.id), customer: str(i.customer), country: str(i.country), reseller: str(i.reseller) })),
    receipts: receiptsResult.data.map((r) => ({ id: str(r.id), receiptNumber: str(r.receiptNumber ?? r.id), customer: str(r.customer), country: str(r.country), reseller: str(r.reseller) })),
    resellers: store.resellerRecords.map((r) => ({ id: r.name, name: r.name, countries: [...r.countries] })),
    countries: store.countries.map((c) => ({ name: c.name, currency: c.currency })),
    users: store.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    contracts: store.contracts.map((c) => ({ id: c.id, customer: c.customer, country: c.country, reseller: c.reseller, contractStatus: c.contractStatus })),
    apiKeys: store.apiKeys.map((k) => ({ id: k.id, keyName: k.keyName, prefix: k.prefix })),
  };
}
