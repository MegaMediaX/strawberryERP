import { describe, expect, it } from "vitest";

import { accountingOverview, currencyUsageCount, invoicingPreview, type AcctInvoice } from "@/lib/admin/accounting";

const NOW = new Date(2026, 5, 16);

const invoices: AcctInvoice[] = [
  { paymentStatus: "Partially Paid", total: 1000, dueDate: "2026-06-10", currency: "USD" }, // overdue + unpaid
  { paymentStatus: "Unpaid", total: 500, dueDate: "2026-06-28", currency: "LBP" }, // unpaid not overdue
  { paymentStatus: "Fully Paid", total: 2000, dueDate: "2026-06-01", currency: "USD" }, // paid
];

describe("accountingOverview (spec §17)", () => {
  it("computes the overview tiles", () => {
    const o = accountingOverview(invoices, [{ isActive: true }, { isActive: false }], [{ isActive: true }, { isActive: true }], NOW);
    expect(o.pendingInvoices).toBe(2);
    expect(o.overdueInvoices).toBe(1);
    expect(o.unpaidBalance).toBe(1500);
    expect(o.activePaymentMethods).toBe(1);
    expect(o.activeCurrencies).toBe(2);
  });
});

describe("currencyUsageCount (spec §20)", () => {
  it("counts invoices in a currency", () => {
    expect(currencyUsageCount("USD", invoices)).toBe(2);
    expect(currencyUsageCount("LBP", invoices)).toBe(1);
    expect(currencyUsageCount("EUR", invoices)).toBe(0);
  });
});

describe("invoicingPreview (spec §18)", () => {
  it("renders the right example per mode", () => {
    expect(invoicingPreview("Global", "INV", "LB-INV").example).toBe("INV-0001");
    expect(invoicingPreview("Country Prefix", "INV", "LB-INV").example).toBe("LB-INV-0001");
    expect(invoicingPreview("Global", "", "").example).toBe("INV-0001");
  });
});
