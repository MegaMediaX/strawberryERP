import { describe, expect, it } from "vitest";

import { saveRecentSearch, searchLeadsAndCustomers, type CustomerLite } from "@/lib/sales/global-search";
import type { PortalLead } from "@/lib/ui-data";

function lead(over: Partial<PortalLead> & { id: string }): PortalLead {
  return {
    company: "Cedar Cloud", contact: "Maya Haddad", gender: "Female", country: "Lebanon", reseller: "R",
    assignedTo: "rami", phone: "+961 70 1", email: "maya@cedar.io", priority: "High",
    status: "Contacted (Interested)", followUp: "", source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

const leads = [lead({ id: "LEAD-1" }), lead({ id: "LEAD-2", company: "Beta Co", contact: "Ali", email: "ali@beta.io" })];
const customers: CustomerLite[] = [
  { id: "CUST-1", name: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners" },
  { id: "CUST-2", name: "Nicosia Retail", country: "Cyprus", reseller: "MedTech Channel CY" },
];

describe("searchLeadsAndCustomers (spec §23)", () => {
  it("returns empty groups for an empty query", () => {
    expect(searchLeadsAndCustomers(leads, customers, "  ")).toEqual({ leads: [], customers: [] });
  });

  it("matches leads by company/contact/email/id (case-insensitive)", () => {
    expect(searchLeadsAndCustomers(leads, customers, "cedar").leads).toHaveLength(1);
    expect(searchLeadsAndCustomers(leads, customers, "ALI").leads[0].id).toBe("LEAD-2");
    expect(searchLeadsAndCustomers(leads, customers, "LEAD-2").leads[0].company).toBe("Beta Co");
  });

  it("matches customers by name/country/reseller", () => {
    expect(searchLeadsAndCustomers(leads, customers, "nicosia").customers).toHaveLength(1);
    expect(searchLeadsAndCustomers(leads, customers, "cyprus").customers[0].id).toBe("CUST-2");
  });

  it("groups both leads and customers for a shared term", () => {
    const r = searchLeadsAndCustomers(leads, customers, "cedar");
    expect(r.leads).toHaveLength(1);
    expect(r.customers).toHaveLength(1);
  });
});

describe("saveRecentSearch", () => {
  it("prepends and de-dupes case-insensitively", () => {
    expect(saveRecentSearch("Cedar", ["beta", "cedar"])).toEqual(["Cedar", "beta"]);
  });
  it("trims to the 5 most recent", () => {
    expect(saveRecentSearch("new", ["a", "b", "c", "d", "e"])).toEqual(["new", "a", "b", "c", "d"]);
  });
  it("ignores an empty term", () => {
    expect(saveRecentSearch("  ", ["a", "b"])).toEqual(["a", "b"]);
  });
});
