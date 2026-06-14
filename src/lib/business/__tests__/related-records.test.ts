import { describe, expect, it } from "vitest";

import { relatedRecordsFor, type RelatedInvoice, type RelatedReceipt } from "@/lib/business/related-records";
import type { PortalLead } from "@/lib/ui-data";

const lead = { company: "Cedar Cloud Services", reseller: "Beirut Digital Partners" } as PortalLead;

const inv = (over: Partial<RelatedInvoice>): RelatedInvoice => ({
  id: "i", invoiceNumber: "N", customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners",
  currency: "USD", total: 100, paymentStatus: "Unpaid", dueDate: "2026-06-01", ...over,
});
const rcpt = (over: Partial<RelatedReceipt>): RelatedReceipt => ({
  id: "r", receiptNumber: "R", customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners",
  currency: "USD", amount: 50, paymentMethod: "Cash", issuedAt: "2026-06-01T00:00:00Z", ...over,
});

describe("relatedRecordsFor (spec §13)", () => {
  it("keeps records matching both customer and reseller", () => {
    const { invoices, receipts } = relatedRecordsFor(lead, [inv({ id: "a" })], [rcpt({ id: "x" })]);
    expect(invoices.map((i) => i.id)).toEqual(["a"]);
    expect(receipts.map((r) => r.id)).toEqual(["x"]);
  });

  it("drops a different reseller (no cross-reseller leak)", () => {
    const out = relatedRecordsFor(lead, [inv({ id: "a", reseller: "Other Reseller" })], []);
    expect(out.invoices).toEqual([]);
  });

  it("drops a different customer", () => {
    const out = relatedRecordsFor(lead, [inv({ id: "a", customer: "Acme" })], []);
    expect(out.invoices).toEqual([]);
  });

  it("returns empty arrays when nothing matches", () => {
    expect(relatedRecordsFor(lead, [], [])).toEqual({ invoices: [], receipts: [] });
  });

  it("sorts newest first by due date / issued date", () => {
    const out = relatedRecordsFor(
      lead,
      [inv({ id: "old", dueDate: "2026-01-01" }), inv({ id: "new", dueDate: "2026-12-01" })],
      [rcpt({ id: "rold", issuedAt: "2026-01-01T00:00:00Z" }), rcpt({ id: "rnew", issuedAt: "2026-12-01T00:00:00Z" })],
    );
    expect(out.invoices.map((i) => i.id)).toEqual(["new", "old"]);
    expect(out.receipts.map((r) => r.id)).toEqual(["rnew", "rold"]);
  });
});
