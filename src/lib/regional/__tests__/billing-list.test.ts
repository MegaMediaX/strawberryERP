import { describe, expect, it } from "vitest";

import {
  filterInvoices,
  filterReceipts,
  overdueInvoiceCount,
  regionalInvoiceRows,
  type RegionalInvoiceLike,
  type RegionalReceiptRow,
} from "@/lib/regional/billing-list";
import type { ReceiptLike } from "@/lib/reseller/invoice-payment-state";

const NOW = new Date(2026, 5, 15);

const invoices: RegionalInvoiceLike[] = [
  { id: "INV-1", invoiceNumber: "LB-1", customer: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners", currency: "USD", total: 1000, dueDate: "2026-06-21", createdBy: "Rami K." },
  { id: "INV-2", invoiceNumber: "JO-1", customer: "Amman Logistics Hub", country: "Jordan", reseller: "Levant Growth Systems", currency: "USD", total: 500, dueDate: "2026-06-01", createdBy: "Lina S." }, // overdue
  { id: "INV-3", invoiceNumber: "LB-2", customer: "Beirut Bistro", country: "Lebanon", reseller: "Beirut Digital Partners", currency: "EUR", total: 800, dueDate: "2026-06-30", createdBy: "Rami K." },
];
const receipts: ReceiptLike[] = [
  { invoice: "INV-1", reseller: "Beirut Digital Partners", amount: 400, paymentMethod: "Bank Transfer" }, // partial
  { invoice: "INV-3", reseller: "Beirut Digital Partners", amount: 800, paymentMethod: "Cash" }, // paid
];

const rows = regionalInvoiceRows(invoices, receipts, NOW);

describe("regionalInvoiceRows (spec §19)", () => {
  it("derives business status, progress, and overdue", () => {
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId["INV-1"].businessStatus).toBe("Partially Paid");
    expect(byId["INV-1"].progress).toBe(40);
    expect(byId["INV-2"].businessStatus).toBe("Overdue"); // unpaid + past due
    expect(byId["INV-2"].overdue).toBe(true);
    expect(byId["INV-3"].businessStatus).toBe("Paid");
    expect(byId["INV-3"].progress).toBe(100);
    expect(byId["INV-3"].overdue).toBe(false);
  });
  it("counts overdue invoices", () => {
    expect(overdueInvoiceCount(rows)).toBe(1);
  });
});

describe("filterInvoices", () => {
  it("filters by reseller, status, currency, and overdue", () => {
    expect(filterInvoices(rows, { status: "Overdue" }).map((r) => r.id)).toEqual(["INV-2"]);
    expect(filterInvoices(rows, { currency: "EUR" }).map((r) => r.id)).toEqual(["INV-3"]);
    expect(filterInvoices(rows, { reseller: "Levant Growth Systems" }).map((r) => r.id)).toEqual(["INV-2"]);
    expect(filterInvoices(rows, { overdueOnly: true }).map((r) => r.id)).toEqual(["INV-2"]);
    expect(filterInvoices(rows, { search: "cedar" }).map((r) => r.id)).toEqual(["INV-1"]);
  });

  it("pendingOnly keeps everything that isn't Fully Paid (the 'Pending invoices' KPI)", () => {
    // INV-1 Partially Paid + INV-2 Overdue are pending; INV-3 Paid is excluded.
    expect(filterInvoices(rows, { pendingOnly: true }).map((r) => r.id).sort()).toEqual(["INV-1", "INV-2"]);
  });
});

describe("filterReceipts (spec §20)", () => {
  const receiptRows: RegionalReceiptRow[] = [
    { id: "R1", receiptNumber: "RCPT-1", invoice: "INV-1", customer: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners", amount: 400, currency: "USD", paymentMethod: "Bank Transfer", issuedBy: "Rami K.", issuedAt: "2026-06-06" },
    { id: "R2", receiptNumber: "RCPT-2", invoice: "INV-3", customer: "Beirut Bistro", country: "Lebanon", reseller: "Beirut Digital Partners", amount: 800, currency: "EUR", paymentMethod: "Cash", issuedBy: "Rami K.", issuedAt: "2026-06-08" },
  ];
  it("filters by payment method, currency, and search", () => {
    expect(filterReceipts(receiptRows, { paymentMethod: "Cash" }).map((r) => r.id)).toEqual(["R2"]);
    expect(filterReceipts(receiptRows, { currency: "USD" }).map((r) => r.id)).toEqual(["R1"]);
    expect(filterReceipts(receiptRows, { search: "rcpt-2" }).map((r) => r.id)).toEqual(["R2"]);
  });
});
