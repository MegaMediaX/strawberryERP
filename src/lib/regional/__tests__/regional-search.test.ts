import { describe, expect, it } from "vitest";

import { regionalSearch, type RegionalSearchData } from "@/lib/regional/regional-search";
import type { PortalLead } from "@/lib/ui-data";

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Cedar Cloud Services", contact: "Maya", gender: "Female", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Rami", phone: "+961", email: "maya@cedar.io", priority: "VIP",
  status: "Contacted (Interested)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const data: RegionalSearchData = {
  leads: [lead({ id: "L1" }), lead({ id: "L2", company: "Amman Logistics Hub", email: "ops@amman.jo", country: "Jordan", reseller: "Levant Growth Systems" })],
  customers: [{ id: "C1", name: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners" }],
  invoices: [{ id: "I1", invoiceNumber: "LB-2026-0041", customer: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners", total: 8325, currency: "USD" }],
  receipts: [{ id: "R1", receiptNumber: "RCPT-2026-0032", customer: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners", amount: 2500, currency: "USD" }],
  resellers: [{ id: "Beirut Digital Partners", name: "Beirut Digital Partners", countries: ["Lebanon"] }],
  contracts: [{ id: "CON1", customer: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners", contractStatus: "Signed" }],
};

describe("regionalSearch (spec §24)", () => {
  it("empty query returns nothing", () => {
    expect(regionalSearch("", data).total).toBe(0);
    expect(regionalSearch("   ", data).total).toBe(0);
  });
  it("matches across all six entity types (case-insensitive)", () => {
    const r = regionalSearch("cedar", data);
    expect(r.leads).toHaveLength(1);
    expect(r.customers).toHaveLength(1);
    expect(r.invoices).toHaveLength(1);
    expect(r.receipts).toHaveLength(1);
    expect(r.contracts).toHaveLength(1);
    expect(r.total).toBe(5);
  });
  it("matches resellers + filters by reseller name", () => {
    expect(regionalSearch("beirut digital", data).resellers).toHaveLength(1);
    expect(regionalSearch("levant", data).leads.map((l) => l.id)).toEqual(["L2"]);
  });
  it("matches invoice number", () => {
    expect(regionalSearch("LB-2026-0041", data).invoices).toHaveLength(1);
  });
});
