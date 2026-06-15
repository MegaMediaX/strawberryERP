import type { PortalLead } from "@/lib/ui-data";

/**
 * Reseller global search (spec §27). Pure + unit-testable, case-insensitive
 * substring across the reseller's already-scoped records. Empty query → empty
 * results (no spam). The inputs are pre-scoped (getUiLeads/getUiRows + reseller
 * team), so results never leak another reseller's data.
 */

export interface CustomerHit { id: string; name: string; country: string }
export interface InvoiceHit { id: string; invoiceNumber: string; customer: string; total: number; currency: string }
export interface ReceiptHit { id: string; receiptNumber: string; customer: string; amount: number; currency: string }
export interface TeamHit { id: string; name: string; email: string; role: string }
export interface ContractHit { id: string; customer: string; contractStatus: string; fileUrl: string }

export interface ResellerSearchData {
  leads: readonly PortalLead[];
  customers: readonly CustomerHit[];
  invoices: readonly InvoiceHit[];
  receipts: readonly ReceiptHit[];
  team: readonly TeamHit[];
  contracts: readonly ContractHit[];
}

export interface ResellerSearchResults {
  leads: PortalLead[];
  customers: CustomerHit[];
  invoices: InvoiceHit[];
  receipts: ReceiptHit[];
  team: TeamHit[];
  contracts: ContractHit[];
  total: number;
}

const has = (q: string, ...parts: (string | number | undefined)[]) =>
  parts.map((p) => String(p ?? "")).join(" ").toLowerCase().includes(q);

export function resellerSearch(query: string, data: ResellerSearchData): ResellerSearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { leads: [], customers: [], invoices: [], receipts: [], team: [], contracts: [], total: 0 };

  const leads = data.leads.filter((l) => has(q, l.company, l.contact, l.email, l.phone, l.id, l.status));
  const customers = data.customers.filter((c) => has(q, c.name, c.country, c.id));
  const invoices = data.invoices.filter((i) => has(q, i.invoiceNumber, i.customer, i.id, i.total));
  const receipts = data.receipts.filter((r) => has(q, r.receiptNumber, r.customer, r.id, r.amount));
  const team = data.team.filter((t) => has(q, t.name, t.email, t.role));
  const contracts = data.contracts.filter((c) => has(q, c.customer, c.contractStatus, c.id));

  const total = leads.length + customers.length + invoices.length + receipts.length + team.length + contracts.length;
  return { leads, customers, invoices, receipts, team, contracts, total };
}
