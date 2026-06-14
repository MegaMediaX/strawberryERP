import type { PortalRole } from "@/lib/portal-security";

/**
 * Advanced reports (Phase 2 slice 3) — pure aggregation over dev-store data.
 * Role-scoped so a report can never reveal out-of-scope rows; the API boundary
 * also enforces scope (assertReportScope) as defence in depth.
 */

export interface ReportScope {
  role: PortalRole;
  countries: readonly string[];
  reseller?: string;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  country?: string;
  reseller?: string;
  source?: string;
}

interface CountryResellerRow {
  country: string;
  reseller: string;
}

/** Whether a row is visible to the scope (role + country/reseller). */
export function rowInScope(scope: ReportScope, row: CountryResellerRow): boolean {
  switch (scope.role) {
    case "Super Admin":
      return true;
    case "Regional Director":
      return scope.countries.includes(row.country);
    case "Reseller Admin":
      return Boolean(scope.reseller) && scope.reseller === row.reseller;
    default:
      return false; // Sales Team User has no report access
  }
}

function withinDate(value: string | undefined, start?: string, end?: string): boolean {
  if (!start && !end) return true;
  if (!value) return false;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return false;
  if (start) {
    const s = Date.parse(start);
    if (!Number.isNaN(s) && ms < s) return false;
  }
  if (end) {
    const e = Date.parse(end);
    if (!Number.isNaN(e) && ms > e) return false;
  }
  return true;
}

function passesFilters(row: CountryResellerRow, filters: ReportFilters): boolean {
  if (filters.country && row.country !== filters.country) return false;
  if (filters.reseller && row.reseller !== filters.reseller) return false;
  return true;
}

/**
 * Validate that the requested filters stay within the scope. Returns an error
 * string (→ 403) or null. Prevents e.g. a Regional Director querying a country
 * outside their assignment, or a Reseller Admin querying another reseller.
 */
export function assertReportScope(scope: ReportScope, filters: ReportFilters): string | null {
  if (scope.role === "Sales Team User") {
    return "Reports are not available for your role.";
  }
  if (scope.role === "Regional Director" && filters.country && !scope.countries.includes(filters.country)) {
    return "Country is outside your assigned scope.";
  }
  if (scope.role === "Reseller Admin" && filters.reseller && filters.reseller !== scope.reseller) {
    return "Reseller is outside your assigned scope.";
  }
  return null;
}

export interface RevenueRow {
  country: string;
  invoiceTotal: number;
  receiptAmount: number;
  invoiceCount: number;
}

interface InvoiceLike {
  country: string;
  reseller: string;
  total: number;
  issuedAt?: string;
}
interface ReceiptLike {
  country?: string;
  reseller?: string;
  amount: number;
  issuedAt?: string;
}

/** Revenue grouped by country (invoice totals + collected receipts), scoped + filtered. */
export function revenueByCountry(
  invoices: readonly InvoiceLike[],
  receipts: readonly ReceiptLike[],
  scope: ReportScope,
  filters: ReportFilters = {},
): { rows: RevenueRow[]; totalInvoiced: number; totalCollected: number } {
  const byCountry = new Map<string, RevenueRow>();
  const get = (country: string) =>
    byCountry.get(country) ?? { country, invoiceTotal: 0, receiptAmount: 0, invoiceCount: 0 };

  for (const inv of invoices) {
    if (!rowInScope(scope, inv) || !passesFilters(inv, filters) || !withinDate(inv.issuedAt, filters.startDate, filters.endDate)) {
      continue;
    }
    const row = get(inv.country);
    row.invoiceTotal += inv.total;
    row.invoiceCount += 1;
    byCountry.set(inv.country, row);
  }

  for (const rec of receipts) {
    const country = rec.country ?? "";
    const reseller = rec.reseller ?? "";
    if (!country) continue; // receipts without a country can't be attributed
    if (!rowInScope(scope, { country, reseller }) || !passesFilters({ country, reseller }, filters) || !withinDate(rec.issuedAt, filters.startDate, filters.endDate)) {
      continue;
    }
    const row = get(country);
    row.receiptAmount += rec.amount;
    byCountry.set(country, row);
  }

  const rows = [...byCountry.values()].sort((a, b) => b.invoiceTotal - a.invoiceTotal);
  return {
    rows,
    totalInvoiced: rows.reduce((sum, r) => sum + r.invoiceTotal, 0),
    totalCollected: rows.reduce((sum, r) => sum + r.receiptAmount, 0),
  };
}

interface LeadLike {
  country: string;
  reseller: string;
  status: string;
  source?: string;
}

export interface ConversionFunnel {
  total: number;
  statusBuckets: Record<string, number>;
  interested: number;
  conversionRate: number; // 0..1, interested / total
  topSource: string | null;
}

const INTERESTED_STATUS = "Contacted (Interested)";

/** Lead conversion funnel: status distribution, conversion rate, top source — scoped + filtered. */
export function leadConversionFunnel(
  leads: readonly LeadLike[],
  scope: ReportScope,
  filters: ReportFilters = {},
): ConversionFunnel {
  const statusBuckets: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let total = 0;
  let interested = 0;

  for (const lead of leads) {
    if (!rowInScope(scope, lead) || !passesFilters(lead, filters)) continue;
    if (filters.source && lead.source !== filters.source) continue;
    total += 1;
    statusBuckets[lead.status] = (statusBuckets[lead.status] ?? 0) + 1;
    if (lead.status === INTERESTED_STATUS) interested += 1;
    if (lead.source) sourceCounts[lead.source] = (sourceCounts[lead.source] ?? 0) + 1;
  }

  const topSource =
    Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    total,
    statusBuckets,
    interested,
    conversionRate: total === 0 ? 0 : interested / total,
    topSource,
  };
}
