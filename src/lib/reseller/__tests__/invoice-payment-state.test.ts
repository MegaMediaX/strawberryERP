import { describe, expect, it } from "vitest";

import { invoicePaymentState, invoiceRowsFor, type InvoiceLike, type ReceiptLike } from "@/lib/reseller/invoice-payment-state";

const inv: InvoiceLike = {
  id: "INV-1", invoiceNumber: "LB-2026-0041", customer: "Cedar Cloud Services", country: "Lebanon",
  reseller: "Beirut Digital Partners", currency: "USD", total: 8000, dueDate: "2026-06-21",
};
const rcpt = (over: Partial<ReceiptLike>): ReceiptLike => ({ invoice: "INV-1", reseller: "Beirut Digital Partners", amount: 0, paymentMethod: "Cash", ...over });

describe("invoicePaymentState (spec §18)", () => {
  it("is Unpaid with no receipts", () => {
    const r = invoicePaymentState(inv, []);
    expect(r).toMatchObject({ amountPaid: 0, remaining: 8000, plainStatus: "Unpaid", paymentMethod: "—" });
  });

  it("is Partially Paid for a deposit and tracks the latest method", () => {
    const r = invoicePaymentState(inv, [rcpt({ amount: 2500, paymentMethod: "Bank Transfer" })]);
    expect(r.amountPaid).toBe(2500);
    expect(r.remaining).toBe(5500);
    expect(r.plainStatus).toBe("Partially Paid");
    expect(r.paymentMethod).toBe("Bank Transfer");
  });

  it("is Paid when receipts cover the total, clamping overpayment", () => {
    const r = invoicePaymentState(inv, [rcpt({ amount: 5000 }), rcpt({ amount: 4000 })]);
    expect(r.amountPaid).toBe(9000);
    expect(r.remaining).toBe(0);
    expect(r.plainStatus).toBe("Paid");
  });

  it("ignores receipts for another invoice or reseller", () => {
    const r = invoicePaymentState(inv, [rcpt({ invoice: "INV-2", amount: 9999 }), rcpt({ reseller: "Other", amount: 9999 })]);
    expect(r.amountPaid).toBe(0);
    expect(r.plainStatus).toBe("Unpaid");
  });
});

describe("invoiceRowsFor (spec §18)", () => {
  it("maps each invoice with its payment state", () => {
    const rows = invoiceRowsFor([inv, { ...inv, id: "INV-2", total: 1000 }], [rcpt({ invoice: "INV-1", amount: 8000 })]);
    expect(rows).toHaveLength(2);
    expect(rows[0].plainStatus).toBe("Paid");
    expect(rows[1].plainStatus).toBe("Unpaid");
  });
});
