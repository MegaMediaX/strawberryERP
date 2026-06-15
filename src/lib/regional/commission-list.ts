import { commissionSummary, type CommissionSummary } from "@/lib/reseller/commission-summary";

/**
 * Regional commissions monitoring (spec §21). Pure + unit-testable. The director
 * can VIEW commissions across resellers in their countries but CANNOT modify
 * rules (read-only). Reuses the tested `commissionSummary` for the cards and
 * adds the §21 "Top Commission Reseller" ranking. Commission-% visibility is
 * permission-gated per §30 via `canViewCommissionPercent`.
 */

export type CommissionStatus = "Pending" | "Approved" | "Paid" | "Cancelled";

export interface RegionalCommissionRow {
  id: string;
  date: string;
  reseller: string;
  country: string;
  invoice: string;
  customer: string;
  trigger: string;
  invoiceAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: CommissionStatus;
}

export interface RegionalCommissionFilters {
  reseller?: string;
  country?: string;
  status?: CommissionStatus;
}

export function regionalCommissionSummary(rows: readonly RegionalCommissionRow[], now: Date): CommissionSummary {
  return commissionSummary(
    rows.map((r) => ({ status: r.status, commissionAmount: r.commissionAmount, calculatedAt: r.date })),
    now,
  );
}

/** §21 "Top Commission Reseller" — the reseller with the highest total commission. */
export function topCommissionReseller(rows: readonly RegionalCommissionRow[]): { reseller: string; amount: number } | null {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.reseller, (totals.get(r.reseller) ?? 0) + r.commissionAmount);
  let top: { reseller: string; amount: number } | null = null;
  for (const [reseller, amount] of totals) {
    if (!top || amount > top.amount) top = { reseller, amount };
  }
  return top;
}

export function filterCommissions(
  rows: readonly RegionalCommissionRow[],
  f: RegionalCommissionFilters,
): RegionalCommissionRow[] {
  return rows.filter((r) => {
    if (f.reseller && r.reseller !== f.reseller) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.status && r.status !== f.status) return false;
    return true;
  });
}

/** §30 permission gate — only a Regional Director / Super Admin sees commission %. */
export function canViewCommissionPercent(role: string): boolean {
  return role === "Regional Director" || role === "Super Admin";
}
