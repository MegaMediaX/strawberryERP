import { describe, expect, it } from "vitest";

import { distinctValues, filterLeads, priorityRank, sortLeads } from "@/lib/sales/lead-filters";
import type { PortalLead } from "@/lib/ui-data";

function lead(over: Partial<PortalLead>): PortalLead {
  return {
    id: "LEAD-1", company: "Acme", contact: "Sara Haddad", gender: "Female", country: "Lebanon",
    reseller: "R", assignedTo: "rami@x", phone: "+961 70 1", email: "s@acme.io", priority: "Medium",
    status: "Contacted (Interested)", followUp: "", source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

const leads = [
  lead({ id: "LEAD-10", company: "Acme", priority: "Low", status: "New Lead (Uncontacted)", source: "WhatsApp", country: "Lebanon" }),
  lead({ id: "LEAD-20", company: "Beta", priority: "VIP", status: "Contacted (Interested)", source: "Referral", country: "Cyprus" }),
  lead({ id: "LEAD-30", company: "Gamma", priority: "High", status: "Scheduled Follow-Up", source: "API", country: "Lebanon" }),
];

describe("filterLeads", () => {
  it("returns all when no filters are set", () => {
    expect(filterLeads(leads, {})).toHaveLength(3);
  });
  it("filters by status, priority, source, and country", () => {
    expect(filterLeads(leads, { status: "Scheduled Follow-Up" })).toHaveLength(1);
    expect(filterLeads(leads, { priority: "VIP" })[0].company).toBe("Beta");
    expect(filterLeads(leads, { source: "Referral" })).toHaveLength(1);
    expect(filterLeads(leads, { country: "Lebanon" })).toHaveLength(2);
  });
  it("searches company/contact/email/phone/id case-insensitively", () => {
    expect(filterLeads(leads, { search: "beta" })).toHaveLength(1);
    expect(filterLeads(leads, { search: "LEAD-30" })[0].company).toBe("Gamma");
    expect(filterLeads(leads, { search: "nomatch" })).toHaveLength(0);
  });
});

describe("sortLeads", () => {
  it("floats VIP/High above Medium/Low by default (priority)", () => {
    expect(sortLeads(leads).map((l) => l.priority)).toEqual(["VIP", "High", "Low"]);
  });
  it("sorts recent by descending lead id number", () => {
    expect(sortLeads(leads, "recent").map((l) => l.id)).toEqual(["LEAD-30", "LEAD-20", "LEAD-10"]);
  });
  it("sorts company alphabetically", () => {
    expect(sortLeads(leads, "company").map((l) => l.company)).toEqual(["Acme", "Beta", "Gamma"]);
  });
});

describe("priorityRank + distinctValues", () => {
  it("ranks known priorities and pushes unknown to the end", () => {
    expect(priorityRank("VIP")).toBeLessThan(priorityRank("Low"));
    expect(priorityRank("Bogus")).toBe(99);
  });
  it("returns sorted distinct field values", () => {
    expect(distinctValues(leads, "country")).toEqual(["Cyprus", "Lebanon"]);
  });
});
