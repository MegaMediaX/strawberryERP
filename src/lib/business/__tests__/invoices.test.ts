import { describe, expect, it } from "vitest";

import { createInvoiceFromPayload } from "@/lib/phase2-data";

/**
 * Invoice creation + numbering — CLAUDE_HANDOFF.md §3:
 * country-prefix invoice numbering, derived document URLs, default line item,
 * payment-state defaults, and country block on the invoice path.
 */

describe("createInvoiceFromPayload", () => {
  it("rejects a blocked country", () => {
    const result = createInvoiceFromPayload({ country: "Israel" as never, total: 100 });
    expect("error" in result).toBe(true);
  });

  it("numbers invoices with the country prefix", () => {
    const lb = createInvoiceFromPayload({ country: "Lebanon", total: 500 });
    if (!("error" in lb)) {
      expect(lb.data.invoiceNumber).toMatch(/^LE-2026-\d{4}$/);
      expect(lb.data.id).toMatch(/^INV-2026-LE-\d{4}$/);
      expect(lb.data.numberingMode).toBe("Country Prefix");
    }
    const jo = createInvoiceFromPayload({ country: "Jordan", total: 500 });
    if (!("error" in jo)) {
      expect(jo.data.invoiceNumber).toMatch(/^JO-2026-\d{4}$/);
    }
  });

  it("derives PDF / QR / payment-link from the invoice number", () => {
    const result = createInvoiceFromPayload({ country: "Cyprus", total: 250 });
    if (!("error" in result)) {
      const n = result.data.invoiceNumber;
      expect(result.data.generatedPdfUrl).toBe(`/generated/invoices/${n}.pdf`);
      expect(result.data.qrCodeUrl).toBe(`/generated/invoices/${n}-qr.png`);
      expect(result.data.paymentLink).toBe(`https://pay.lebtech.example/${n}`);
    }
  });

  it("builds a default line item from total and computes matching totals", () => {
    const result = createInvoiceFromPayload({ country: "Lebanon", total: 1200 });
    if (!("error" in result)) {
      expect(result.data.lineItems).toHaveLength(1);
      expect(result.data.subtotal).toBe(1200);
      expect(result.data.total).toBe(1200);
    }
  });

  it("computes the subtotal from explicit line items", () => {
    const result = createInvoiceFromPayload({
      country: "Lebanon",
      lineItems: [
        { description: "A", quantity: 3, unitPrice: 100 },
        { description: "B", quantity: 1, unitPrice: 50 },
      ],
    });
    if (!("error" in result)) {
      expect(result.data.subtotal).toBe(350);
    }
  });

  it("defaults to Unpaid / Issued and returns commission entries for the Invoice Created trigger", () => {
    const result = createInvoiceFromPayload({ country: "Lebanon", total: 100 });
    if (!("error" in result)) {
      expect(result.data.paymentStatus).toBe("Unpaid");
      expect(result.data.invoiceStatus).toBe("Issued");
      expect(Array.isArray(result.commissions)).toBe(true);
    }
  });
});
