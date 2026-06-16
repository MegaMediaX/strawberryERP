/**
 * Super Admin Global Search (spec §36). Pure + unit-testable + client-safe.
 * Searches across every module a Super Admin can see, groups hits by module,
 * and shows ownership (country / reseller). Results link to /admin/* routes.
 */

export interface AdminSearchData {
  leads: { id: string; company: string; contact: string; status: string; country: string; reseller: string }[];
  customers: { id: string; name: string; country: string; reseller: string }[];
  invoices: { id: string; invoiceNumber: string; customer: string; country: string; reseller: string }[];
  receipts: { id: string; receiptNumber: string; customer: string; country: string; reseller: string }[];
  resellers: { id: string; name: string; countries: string[] }[];
  countries: { name: string; currency: string }[];
  users: { id: string; name: string; email: string; role: string }[];
  contracts: { id: string; customer: string; country: string; reseller: string; contractStatus: string }[];
  apiKeys: { id: string; keyName: string; prefix: string }[];
}

export interface SearchHit {
  id: string;
  title: string;
  sub: string;
  href: string;
  country?: string;
  reseller?: string;
}

export interface SearchGroup {
  module: string;
  hits: SearchHit[];
}

export interface AdminSearchResults {
  groups: SearchGroup[];
  total: number;
}

const has = (q: string, ...fields: (string | undefined)[]) => fields.some((f) => (f ?? "").toLowerCase().includes(q));

/** Minimum query length before searching. */
export const MIN_QUERY = 2;

export function adminGlobalSearch(query: string, data: AdminSearchData): AdminSearchResults {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY) return { groups: [], total: 0 };

  const groups: SearchGroup[] = [];
  const add = (module: string, hits: SearchHit[]) => { if (hits.length) groups.push({ module, hits }); };

  add("Leads", data.leads.filter((l) => has(q, l.company, l.contact, l.status, l.id))
    .map((l) => ({ id: l.id, title: l.company, sub: `${l.contact} · ${l.status}`, href: `/admin/leads/${l.id}`, country: l.country, reseller: l.reseller })));

  add("Customers", data.customers.filter((c) => has(q, c.name, c.id))
    .map((c) => ({ id: c.id, title: c.name, sub: "Customer", href: `/admin/customers/${c.id}`, country: c.country, reseller: c.reseller })));

  add("Invoices", data.invoices.filter((i) => has(q, i.invoiceNumber, i.customer, i.id))
    .map((i) => ({ id: i.id, title: i.invoiceNumber, sub: i.customer, href: `/admin/invoices`, country: i.country, reseller: i.reseller })));

  add("Receipts", data.receipts.filter((r) => has(q, r.receiptNumber, r.customer, r.id))
    .map((r) => ({ id: r.id, title: r.receiptNumber, sub: r.customer, href: `/admin/receipts`, country: r.country, reseller: r.reseller })));

  add("Resellers", data.resellers.filter((r) => has(q, r.name, r.id))
    .map((r) => ({ id: r.id, title: r.name, sub: "Reseller", href: `/admin/resellers/${encodeURIComponent(r.id)}`, reseller: r.name, country: r.countries.join(", ") })));

  add("Countries", data.countries.filter((c) => has(q, c.name, c.currency))
    .map((c) => ({ id: c.name, title: c.name, sub: `Currency ${c.currency}`, href: `/admin/countries`, country: c.name })));

  add("Users", data.users.filter((u) => has(q, u.name, u.email, u.role))
    .map((u) => ({ id: u.id, title: u.name, sub: `${u.role} · ${u.email}`, href: `/admin/users/${u.id}` })));

  add("Contracts", data.contracts.filter((c) => has(q, c.customer, c.id, c.contractStatus))
    .map((c) => ({ id: c.id, title: c.customer, sub: `Contract · ${c.contractStatus}`, href: `/admin/customers/${c.id}`, country: c.country, reseller: c.reseller })));

  add("API keys", data.apiKeys.filter((k) => has(q, k.keyName, k.prefix, k.id))
    .map((k) => ({ id: k.id, title: k.keyName, sub: `${k.prefix}…`, href: `/admin/api/keys` })));

  return { groups, total: groups.reduce((sum, g) => sum + g.hits.length, 0) };
}
