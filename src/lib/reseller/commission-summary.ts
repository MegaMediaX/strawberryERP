/**
 * Reseller commission summary (spec §21). Pure + unit-testable. Sums the
 * already-reseller-scoped commission entries by status, plus a "this month"
 * total (by calculatedAt). View-only — the reseller never edits rules here.
 */

export interface CommissionLike {
  status: "Pending" | "Approved" | "Paid" | "Cancelled";
  commissionAmount: number;
  calculatedAt: string;
}

export interface CommissionSummary {
  pending: number;
  approved: number;
  paid: number;
  thisMonth: number;
}

export function commissionSummary(entries: readonly CommissionLike[], now: Date): CommissionSummary {
  const summary: CommissionSummary = { pending: 0, approved: 0, paid: 0, thisMonth: 0 };
  const y = now.getFullYear();
  const m = now.getMonth();
  for (const e of entries) {
    if (e.status === "Pending") summary.pending += e.commissionAmount;
    else if (e.status === "Approved") summary.approved += e.commissionAmount;
    else if (e.status === "Paid") summary.paid += e.commissionAmount;
    const d = new Date(e.calculatedAt);
    if (d.getFullYear() === y && d.getMonth() === m) summary.thisMonth += e.commissionAmount;
  }
  return summary;
}
