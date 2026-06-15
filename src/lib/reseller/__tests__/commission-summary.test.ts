import { describe, expect, it } from "vitest";

import { commissionSummary, type CommissionLike } from "@/lib/reseller/commission-summary";

const NOW = new Date(2026, 5, 15); // June 2026

const e = (over: Partial<CommissionLike>): CommissionLike => ({
  status: "Pending", commissionAmount: 100, calculatedAt: "2026-06-06T13:15:00Z", ...over,
});

describe("commissionSummary (spec §21)", () => {
  it("is all-zero for no entries", () => {
    expect(commissionSummary([], NOW)).toEqual({ pending: 0, approved: 0, paid: 0, thisMonth: 0 });
  });

  it("sums by status and ignores Cancelled in status totals", () => {
    const s = commissionSummary([
      e({ status: "Pending", commissionAmount: 300 }),
      e({ status: "Pending", commissionAmount: 150 }),
      e({ status: "Approved", commissionAmount: 200 }),
      e({ status: "Paid", commissionAmount: 500 }),
      e({ status: "Cancelled", commissionAmount: 999 }),
    ], NOW);
    expect(s.pending).toBe(450);
    expect(s.approved).toBe(200);
    expect(s.paid).toBe(500);
  });

  it("thisMonth counts every status in the current month, excludes other months", () => {
    const s = commissionSummary([
      e({ commissionAmount: 100, calculatedAt: "2026-06-01T00:00:00Z" }),
      e({ status: "Paid", commissionAmount: 50, calculatedAt: "2026-06-30T00:00:00Z" }),
      e({ commissionAmount: 999, calculatedAt: "2026-05-31T00:00:00Z" }), // May — excluded
      e({ commissionAmount: 999, calculatedAt: "2025-06-15T00:00:00Z" }), // last year — excluded
    ], NOW);
    expect(s.thisMonth).toBe(150);
  });
});
