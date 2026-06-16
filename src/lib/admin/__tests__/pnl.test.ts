import { describe, expect, it } from "vitest";

import {
  expenseSummaryByCategory,
  pnlSummary,
  validateExpense,
  type ExpenseRecord,
} from "@/lib/admin/pnl";

describe("validateExpense (spec §21)", () => {
  const good = { category: "Software", amount: 500, currency: "USD", date: "2026-06-01" };
  it("accepts a complete expense", () => {
    expect(validateExpense(good)).toBeNull();
  });
  it("requires category, positive amount, currency, date", () => {
    expect(validateExpense({ ...good, category: "Nope" })).toMatch(/category/);
    expect(validateExpense({ ...good, amount: 0 })).toMatch(/greater than zero/);
    expect(validateExpense({ ...good, currency: "" })).toMatch(/currency/);
    expect(validateExpense({ ...good, date: "" })).toMatch(/date is required/);
  });
});

describe("pnlSummary (spec §21)", () => {
  it("derives gross + net profit", () => {
    const p = pnlSummary(
      [{ amount: 10000 }, { amount: 5000 }],
      [{ amount: 3000 }],
      [{ commissionAmount: 1200 }, { commissionAmount: 800 }],
    );
    expect(p.revenue).toBe(15000);
    expect(p.expenses).toBe(3000);
    expect(p.commissions).toBe(2000);
    expect(p.grossProfit).toBe(12000); // 15000 - 3000
    expect(p.netProfit).toBe(10000); // 15000 - 3000 - 2000
  });
  it("handles empty inputs", () => {
    expect(pnlSummary([], [], [])).toEqual({ revenue: 0, expenses: 0, commissions: 0, grossProfit: 0, netProfit: 0 });
  });
});

describe("expenseSummaryByCategory", () => {
  it("sums + ranks by category", () => {
    const e: ExpenseRecord[] = [
      { id: "E1", category: "Software", amount: 500, currency: "USD", date: "2026-06-01", notes: "", attachmentName: "" },
      { id: "E2", category: "Software", amount: 300, currency: "USD", date: "2026-06-02", notes: "", attachmentName: "" },
      { id: "E3", category: "Marketing", amount: 1000, currency: "USD", date: "2026-06-03", notes: "", attachmentName: "" },
    ];
    expect(expenseSummaryByCategory(e)).toEqual([
      { category: "Marketing", total: 1000 },
      { category: "Software", total: 800 },
    ]);
  });
});
