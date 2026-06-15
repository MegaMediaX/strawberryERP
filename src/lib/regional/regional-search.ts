import type { PortalLead } from "@/lib/ui-data";

/**
 * Regional global search (spec §24). Pure + unit-testable, case-insensitive
 * substring across the director's already country-scoped records. Every result
 * carries country + reseller ownership. Empty query → empty results (no spam).
 * Inputs are pre-scoped (regionalScopedData), so results never leak another
 * country's data. Searches Leads / Customers / Invoices / Receipts / Resellers /
 * Contracts (§24).
 */

export interface SearchCustomer { id: string; name: string; country: string; reseller: string }
export interface SearchInvoice { id: string; invoiceNumber: string; customer: string; country: string; reseller: string; total: number; currency: string }
export interface SearchReceipt { id: string; receiptNumber: string; customer: string; country: string; reseller: string; amount: number; currency: string }
export interface SearchReseller { id: string; name: string; countries: string[] }
export interface SearchContract { id: string; customer: string; country: string; reseller: string; contractStatus: string }

export interface RegionalSearchData {
  leads: readonly PortalLead[];
  customers: readonly SearchCustomer[];
  invoices: readonly SearchInvoice[];
  receipts: readonly SearchReceipt[];
  resellers: readonly SearchReseller[];
  contracts: readonly SearchContract[];
}

export interface RegionalSearchResults {
  leads: PortalLead[];
  customers: SearchCustomer[];
  invoices: SearchInvoice[];
  receipts: SearchReceipt[];
  resellers: SearchReseller[];
  contracts: SearchContract[];
  total: number;
}

const has = (q: string, ...parts: (string | number | undefined)[]) =>
  parts.map((p) => String(p ?? "")).join(" ").toLowerCase().includes(q);

export function regionalSearch(query: string, data: RegionalSearchData): RegionalSearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { leads: [], customers: [], invoices: [], receipts: [], resellers: [], contracts: [], total: 0 };

  const leads = data.leads.filter((l) => has(q, l.company, l.contact, l.email, l.phone, l.id, l.status, l.reseller, l.country));
  const customers = data.customers.filter((c) => has(q, c.name, c.country, c.reseller, c.id));
  const invoices = data.invoices.filter((i) => has(q, i.invoiceNumber, i.customer, i.reseller, i.country, i.id, i.total));
  const receipts = data.receipts.filter((r) => has(q, r.receiptNumber, r.customer, r.reseller, r.country, r.id, r.amount));
  const resellers = data.resellers.filter((r) => has(q, r.name, r.countries.join(" "), r.id));
  const contracts = data.contracts.filter((c) => has(q, c.customer, c.reseller, c.country, c.contractStatus, c.id));

  const total = leads.length + customers.length + invoices.length + receipts.length + resellers.length + contracts.length;
  return { leads, customers, invoices, receipts, resellers, contracts, total };
}
