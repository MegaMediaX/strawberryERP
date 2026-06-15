import { describe, expect, it } from "vitest";

import { filterReceipts, receiptsTotal, type ReceiptRow } from "@/lib/reseller/receipt-list";

const rcpt = (over: Partial<ReceiptRow> & { id: string }): ReceiptRow => ({
  receiptNumber: "RCPT-1", invoice: "INV-1", customer: "Cedar Cloud Services", amount: 2500,
  currency: "USD", paymentMethod: "Bank Transfer", paymentReference: "BLC-1", issuedBy: "Rami K.",
  issuedAt: "2026-06-06T13:15:00Z", pdfUrl: "/x.pdf", ...over,
});

const rows = [
  rcpt({ id: "1", receiptNumber: "RCPT-0032", paymentMethod: "Bank Transfer", amount: 2500 }),
  rcpt({ id: "2", receiptNumber: "RCPT-0033", customer: "Beta Co", paymentMethod: "Cash", amount: 1000 }),
];

describe("filterReceipts (spec §20)", () => {
  it("filters by search across number/customer/invoice/reference", () => {
    expect(filterReceipts(rows, { search: "cedar" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterReceipts(rows, { search: "0033" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("filters by payment method", () => {
    expect(filterReceipts(rows, { method: "Cash" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("returns all with no filters and sums amounts", () => {
    expect(filterReceipts(rows, {})).toHaveLength(2);
    expect(receiptsTotal(rows)).toBe(3500);
  });
});
