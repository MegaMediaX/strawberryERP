import { describe, expect, it } from "vitest";

import { adminGlobalSearch, MIN_QUERY, type AdminSearchData } from "@/lib/admin/global-search";

const data: AdminSearchData = {
  leads: [{ id: "LEAD-1", company: "Acme Logistics", contact: "Sara", status: "Interested", country: "Lebanon", reseller: "Beirut Digital Partners" }],
  customers: [{ id: "CUST-1", name: "Acme Corp", country: "Cyprus", reseller: "Nicosia Trade Hub" }],
  invoices: [{ id: "INV-1", invoiceNumber: "LB-INV-0001", customer: "Acme Corp", country: "Lebanon", reseller: "B" }],
  receipts: [{ id: "RCP-1", receiptNumber: "RCP-0001", customer: "Other", country: "Jordan", reseller: "C" }],
  resellers: [{ id: "Acme Resellers", name: "Acme Resellers", countries: ["Lebanon", "Cyprus"] }],
  countries: [{ name: "Lebanon", currency: "LBP" }],
  users: [{ id: "USR-1", name: "Acme Admin", email: "admin@acme.io", role: "Super Admin" }],
  contracts: [{ id: "CON-1", customer: "Acme Corp", country: "Lebanon", reseller: "B", contractStatus: "Signed" }],
  apiKeys: [{ id: "APIK-1", keyName: "Acme Sync", prefix: "ltp_live_aa" }],
};

describe("adminGlobalSearch (spec §36)", () => {
  it("ignores queries shorter than MIN_QUERY", () => {
    expect(MIN_QUERY).toBe(2);
    expect(adminGlobalSearch("a", data).total).toBe(0);
  });
  it("finds hits across every matching module + groups them", () => {
    const res = adminGlobalSearch("acme", data);
    // matches: leads, customers, invoices, resellers, users, contracts, api keys (not receipts/countries)
    expect(res.total).toBe(7);
    expect(res.groups.map((g) => g.module)).toEqual([
      "Leads", "Customers", "Invoices", "Resellers", "Users", "Contracts", "API keys",
    ]);
  });
  it("links results to /admin routes + carries ownership", () => {
    const res = adminGlobalSearch("acme", data);
    const leads = res.groups.find((g) => g.module === "Leads")!;
    expect(leads.hits[0].href).toBe("/admin/leads/LEAD-1");
    expect(leads.hits[0]).toMatchObject({ country: "Lebanon", reseller: "Beirut Digital Partners" });
  });
  it("matches case-insensitively on multiple fields", () => {
    expect(adminGlobalSearch("interested", data).groups.find((g) => g.module === "Leads")?.hits).toHaveLength(1);
    expect(adminGlobalSearch("super admin", data).groups.find((g) => g.module === "Users")?.hits).toHaveLength(1);
    expect(adminGlobalSearch("lbp", data).groups.find((g) => g.module === "Countries")?.hits).toHaveLength(1);
  });
});
