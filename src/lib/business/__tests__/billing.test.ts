import { describe, expect, it } from "vitest";

import {
  calculateCommissionEntries,
  calculateInvoiceTotals,
  commissionRules,
  type Invoice,
} from "@/lib/phase2-data";

/**
 * Billing business-logic — CLAUDE_HANDOFF.md §3.
 * Invoice totals and the commission formula:
 *   commission_amount = base_amount * commission_percentage / 100
 */

describe("calculateInvoiceTotals", () => {
  it("sums line items into a subtotal", () => {
    const t = calculateInvoiceTotals(
      [
        { description: "A", quantity: 2, unitPrice: 100 },
        { description: "B", quantity: 1, unitPrice: 50 },
      ],
      0,
      0,
    );
    expect(t.subtotal).toBe(250);
    expect(t.total).toBe(250);
  });

  it("applies discount then tax: total = subtotal - discount + tax", () => {
    const t = calculateInvoiceTotals([{ description: "A", quantity: 1, unitPrice: 1000 }], 100, 150);
    expect(t.subtotal).toBe(1000);
    expect(t.discount).toBe(100);
    expect(t.taxAmount).toBe(150);
    expect(t.total).toBe(1050);
  });

  it("never produces a negative total or negative discount/tax", () => {
    const t = calculateInvoiceTotals([{ description: "A", quantity: 1, unitPrice: 100 }], 999, -50);
    expect(t.total).toBe(0);
    expect(t.taxAmount).toBe(0);
  });
});

describe("calculateCommissionEntries — formula and scoping", () => {
  const activeRule = commissionRules.find((rule) => rule.isActive);

  it("has at least one active rule fixture to exercise", () => {
    expect(activeRule).toBeDefined();
  });

  it("computes commissionAmount = total * percentage / 100 for a matching invoice", () => {
    if (!activeRule) return;
    const invoice = {
      id: "INV-TEST-1",
      country: activeRule.country,
      reseller: activeRule.reseller,
      total: 1000,
    } as unknown as Invoice;

    const entries = calculateCommissionEntries({ event: activeRule.triggerCondition, invoice });
    const entry = entries.find((e) => e.commissionRule === activeRule.id);
    expect(entry).toBeDefined();
    expect(entry!.baseAmount).toBe(1000);
    expect(entry!.commissionAmount).toBeCloseTo((1000 * activeRule.commissionPercentage) / 100, 6);
    expect(entry!.status).toBe("Pending");
  });

  it("produces no entry when country/reseller do not match (scope isolation)", () => {
    if (!activeRule) return;
    const invoice = {
      id: "INV-TEST-2",
      country: activeRule.country,
      reseller: "NON-MATCHING-RESELLER-ZZZ",
      total: 1000,
    } as unknown as Invoice;
    const entries = calculateCommissionEntries({ event: activeRule.triggerCondition, invoice });
    expect(entries.find((e) => e.commissionRule === activeRule.id)).toBeUndefined();
  });
});
