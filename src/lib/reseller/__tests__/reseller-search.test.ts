import { describe, expect, it } from "vitest";

import { resellerSearch, type ResellerSearchData } from "@/lib/reseller/reseller-search";
import type { PortalLead } from "@/lib/ui-data";

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Cedar Cloud Services", contact: "Maya", gender: "Female", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Marven El Mouallem", phone: "+961 70 1", email: "maya@cedar.example", priority: "VIP",
  status: "Scheduled Follow-Up", followUp: "Today", source: "WhatsApp", notes: "",
  ...over,
});

const data: ResellerSearchData = {
  leads: [lead({ id: "LEAD-1" })],
  customers: [{ id: "CUST-1", name: "Cedar Cloud Services", country: "Lebanon" }],
  invoices: [{ id: "INV-1", invoiceNumber: "LB-2026-0041", customer: "Cedar Cloud Services", total: 8000, currency: "USD" }],
  receipts: [{ id: "RCPT-1", receiptNumber: "RCPT-2026-0032", customer: "Cedar Cloud Services", amount: 2500, currency: "USD" }],
  team: [{ id: "USR-1", name: "Marven El Mouallem", email: "rami@beirut.example", role: "Sales Team User" }],
  contracts: [{ id: "CON-1", customer: "Cedar Cloud Services", contractStatus: "Signed", fileUrl: "/x.pdf" }],
};

describe("resellerSearch (spec §27)", () => {
  it("returns empty results for a blank query", () => {
    expect(resellerSearch("  ", data).total).toBe(0);
  });

  it("matches across every module (case-insensitive)", () => {
    const r = resellerSearch("cedar", data);
    expect(r.leads).toHaveLength(1);
    expect(r.customers).toHaveLength(1);
    expect(r.invoices).toHaveLength(1);
    expect(r.receipts).toHaveLength(1);
    expect(r.contracts).toHaveLength(1);
    expect(r.team).toHaveLength(0); // Rami isn't "cedar"
    expect(r.total).toBe(5);
  });

  it("finds a team member by name and an invoice by number", () => {
    expect(resellerSearch("rami", data).team).toHaveLength(1);
    expect(resellerSearch("LB-2026", data).invoices).toHaveLength(1);
  });

  it("returns nothing for an unmatched term", () => {
    expect(resellerSearch("zzzz", data).total).toBe(0);
  });
});
