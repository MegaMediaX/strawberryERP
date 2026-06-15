import { describe, expect, it } from "vitest";

import {
  canViewCommissionPercent,
  filterCommissions,
  regionalCommissionSummary,
  topCommissionReseller,
  type RegionalCommissionRow,
} from "@/lib/regional/commission-list";

const NOW = new Date(2026, 5, 15);

const row = (over: Partial<RegionalCommissionRow> & { id: string }): RegionalCommissionRow => ({
  date: "2026-06-06T13:15:00Z", reseller: "Beirut Digital Partners", country: "Lebanon",
  invoice: "INV-1", customer: "Cedar Cloud Services", trigger: "Receipt recorded",
  invoiceAmount: 2500, commissionPercentage: 12, commissionAmount: 300, status: "Pending",
  ...over,
});

const rows = [
  row({ id: "C1", status: "Pending", commissionAmount: 300 }),
  row({ id: "C2", status: "Approved", commissionAmount: 200, reseller: "Levant Growth Systems", country: "Jordan" }),
  row({ id: "C3", status: "Paid", commissionAmount: 500, date: "2026-05-02T00:00:00Z" }),
];

describe("regionalCommissionSummary (spec §21)", () => {
  it("sums by status + this month", () => {
    const s = regionalCommissionSummary(rows, NOW);
    expect(s.pending).toBe(300);
    expect(s.approved).toBe(200);
    expect(s.paid).toBe(500);
    expect(s.thisMonth).toBe(500); // C1 (Jun) 300 + C2 (Jun) 200; C3 is May
  });
});

describe("topCommissionReseller", () => {
  it("returns the reseller with the highest total commission", () => {
    // BDP: 300 (C1) + 500 (C3) = 800; Levant: 200
    expect(topCommissionReseller(rows)).toEqual({ reseller: "Beirut Digital Partners", amount: 800 });
  });
  it("returns null on empty input", () => {
    expect(topCommissionReseller([])).toBeNull();
  });
});

describe("filterCommissions", () => {
  it("filters by reseller, country, and status", () => {
    expect(filterCommissions(rows, { reseller: "Levant Growth Systems" }).map((r) => r.id)).toEqual(["C2"]);
    expect(filterCommissions(rows, { country: "Jordan" }).map((r) => r.id)).toEqual(["C2"]);
    expect(filterCommissions(rows, { status: "Paid" }).map((r) => r.id)).toEqual(["C3"]);
  });
});

describe("canViewCommissionPercent (spec §30)", () => {
  it("grants Regional Director + Super Admin, denies others", () => {
    expect(canViewCommissionPercent("Regional Director")).toBe(true);
    expect(canViewCommissionPercent("Super Admin")).toBe(true);
    expect(canViewCommissionPercent("Reseller Admin")).toBe(false);
    expect(canViewCommissionPercent("Sales Team User")).toBe(false);
  });
});
