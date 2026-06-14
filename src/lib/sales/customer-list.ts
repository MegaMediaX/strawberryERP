import type { CustomerLite } from "@/lib/sales/global-search";

/**
 * Sales customer directory (spec §18, minimal list) — pure filter + sort over
 * the already-scoped customer list ({ id, name, country, reseller }). Detail
 * view is deferred until per-customer data exists.
 */
export type CustomerSort = "name" | "country" | "reseller";

export function filterCustomers(customers: readonly CustomerLite[], query: string): CustomerLite[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...customers];
  return customers.filter((c) => [c.name, c.country, c.reseller, c.id].join(" ").toLowerCase().includes(q));
}

export function sortCustomers(customers: readonly CustomerLite[], by: CustomerSort = "name"): CustomerLite[] {
  return [...customers].sort((a, b) => a[by].localeCompare(b[by]));
}
