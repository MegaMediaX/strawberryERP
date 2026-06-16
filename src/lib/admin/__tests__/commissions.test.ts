import { describe, expect, it } from "vitest";

import {
  adminCommissionSummary,
  filterCommissions,
  recalculateCommissionAmount,
  topCommissionReseller,
} from "@/lib/admin/commissions";
import type { CommissionEntry } from "@/lib/phase2-data";

const e = (over: Partial<CommissionEntry>): CommissionEntry => ({
  id: "C1",
  commissionRule: "R1",
  reseller: "Reseller A",
  country: "Lebanon",
  invoice: "INV-1",
  baseAmount: 1000,
  commissionPercentage: 10,
  commissionAmount: 100,
  status: "Pending",
  calculatedAt: "2026-06-10",
  ...over,
});

describe("adminCommissionSummary (spec §22)", () => {
  it("sums by status + this month", () => {
    const now = new Date("2026-06-16");
    const s = adminCommissionSummary(
      [
        e({ status: "Pending", commissionAmount: 100 }),
        e({ status: "Approved", commissionAmount: 200 }),
        e({ status: "Paid", commissionAmount: 300, calculatedAt: "2026-05-01" }),
      ],
      now,
    );
    expect(s.pending).toBe(100);
    expect(s.approved).toBe(200);
    expect(s.paid).toBe(300);
    expect(s.thisMonth).toBe(300); // the two June entries (100 + 200)
  });
});

describe("topCommissionReseller (spec §22)", () => {
  it("ranks resellers by total commission", () => {
    const top = topCommissionReseller([
      e({ reseller: "A", commissionAmount: 100 }),
      e({ reseller: "B", commissionAmount: 250 }),
      e({ reseller: "A", commissionAmount: 200 }),
    ]);
    expect(top).toEqual({ reseller: "A", amount: 300 });
  });
  it("returns null for no entries", () => {
    expect(topCommissionReseller([])).toBeNull();
  });
});

describe("filterCommissions (spec §22)", () => {
  it("filters by reseller, country, status", () => {
    const rows = [
      e({ id: "1", reseller: "A", country: "Lebanon", status: "Pending" }),
      e({ id: "2", reseller: "B", country: "Cyprus", status: "Approved" }),
    ];
    expect(filterCommissions(rows, { reseller: "A" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterCommissions(rows, { country: "Cyprus" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterCommissions(rows, { status: "Approved" }).map((r) => r.id)).toEqual(["2"]);
  });
});

describe("recalculateCommissionAmount (spec §22)", () => {
  it("recomputes amount from base × percentage, rounded", () => {
    expect(recalculateCommissionAmount({ baseAmount: 1000, commissionPercentage: 10 })).toBe(100);
    expect(recalculateCommissionAmount({ baseAmount: 1234.5, commissionPercentage: 7.5 })).toBe(92.59);
  });
});
