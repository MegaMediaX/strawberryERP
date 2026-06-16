import type { CommissionEntry, CommissionStatus } from "@/lib/phase2-data";
import { commissionSummary, type CommissionSummary } from "@/lib/reseller/commission-summary";

/**
 * Super Admin commission management (spec §22). Pure + unit-testable.
 * Unlike the Regional/Reseller monitors (read-only), the Super Admin can
 * APPROVE, MARK PAID, and RECALCULATE entries. Transition + authorization
 * logic is reused from `commission-approval`; this module adds the global
 * summary (incl. Top Commission Reseller) and the recalculation primitive.
 */

export type AdminCommissionAction = "approve" | "mark-paid" | "recalculate" | "cancel";

/** Maps a row action to the target status (recalculate keeps the status). */
export const COMMISSION_ACTION_STATUS: Record<Exclude<AdminCommissionAction, "recalculate">, CommissionStatus> = {
  approve: "Approved",
  "mark-paid": "Paid",
  cancel: "Cancelled",
};

export interface AdminCommissionFilters {
  reseller?: string;
  country?: string;
  status?: CommissionStatus;
}

/** §22 summary cards — reuses the tested `commissionSummary` (pending/approved/paid/thisMonth). */
export function adminCommissionSummary(entries: readonly CommissionEntry[], now: Date): CommissionSummary {
  return commissionSummary(
    entries.map((e) => ({ status: e.status, commissionAmount: e.commissionAmount, calculatedAt: e.calculatedAt })),
    now,
  );
}

/** §22 "Top Commission Reseller" — highest total commission across all entries. */
export function topCommissionReseller(entries: readonly CommissionEntry[]): { reseller: string; amount: number } | null {
  const totals = new Map<string, number>();
  for (const e of entries) totals.set(e.reseller, (totals.get(e.reseller) ?? 0) + e.commissionAmount);
  let top: { reseller: string; amount: number } | null = null;
  for (const [reseller, amount] of totals) {
    if (!top || amount > top.amount) top = { reseller, amount };
  }
  return top;
}

export function filterCommissions(
  entries: readonly CommissionEntry[],
  f: AdminCommissionFilters,
): CommissionEntry[] {
  return entries.filter((e) => {
    if (f.reseller && e.reseller !== f.reseller) return false;
    if (f.country && e.country !== f.country) return false;
    if (f.status && e.status !== f.status) return false;
    return true;
  });
}

/**
 * Recalculate the commission amount from the base amount + percentage.
 * Mirrors the auto-create formula (rounded to 2 decimals). Returns the new
 * amount so the caller can audit old → new.
 */
export function recalculateCommissionAmount(entry: Pick<CommissionEntry, "baseAmount" | "commissionPercentage">): number {
  return Math.round(entry.baseAmount * (entry.commissionPercentage / 100) * 100) / 100;
}
