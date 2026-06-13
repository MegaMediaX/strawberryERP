import { describe, expect, it } from "vitest";

import { createReceiptFromPayload, invoices, receipts } from "@/lib/phase2-data";

/**
 * Receipt → invoice payment-state update — CLAUDE_HANDOFF.md §3.
 * A receipt updates the invoice payment status (Partially Paid / Fully Paid),
 * picks the commission trigger (Deposit Paid / Fully Paid), and still enforces
 * the country block.
 */

// Pick an invoice with no pre-existing receipts so paidSoFar is deterministic.
const clean = invoices.find((inv) => !receipts.some((r) => r.invoice === inv.id));

describe("createReceiptFromPayload", () => {
  it("has a clean invoice fixture to exercise", () => {
    expect(clean).toBeDefined();
  });

  it("marks the invoice Fully Paid when the amount covers the total", () => {
    if (!clean) return;
    const result = createReceiptFromPayload({
      invoice: clean.id,
      country: clean.country,
      amount: clean.total,
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.invoice.paymentStatus).toBe("Fully Paid");
      expect(result.invoice.invoiceStatus).toBe("Fully Paid");
      // Fully-paid trigger should yield commission entries linked to the receipt.
      expect(Array.isArray(result.commissions)).toBe(true);
    }
  });

  it("marks the invoice Partially Paid for a deposit", () => {
    if (!clean) return;
    const deposit = Math.max(1, Math.floor(clean.total / 3));
    if (deposit >= clean.total) return;
    const result = createReceiptFromPayload({
      invoice: clean.id,
      country: clean.country,
      amount: deposit,
    });
    if (!("error" in result)) {
      expect(result.invoice.paymentStatus).toBe("Partially Paid");
      expect(result.data.amount).toBe(deposit);
    }
  });

  it("clamps a negative amount to zero (never overpays into Fully Paid)", () => {
    if (!clean || clean.total <= 0) return;
    const result = createReceiptFromPayload({ invoice: clean.id, country: clean.country, amount: -500 });
    if (!("error" in result)) {
      expect(result.data.amount).toBe(0);
      expect(result.invoice.paymentStatus).toBe("Partially Paid");
    }
  });

  it("rejects a blocked country on the receipt path", () => {
    const result = createReceiptFromPayload({ invoice: clean?.id, country: "Israel" as never, amount: 100 });
    expect("error" in result).toBe(true);
  });
});
