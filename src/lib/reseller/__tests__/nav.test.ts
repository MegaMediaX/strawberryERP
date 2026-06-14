import { describe, expect, it } from "vitest";

import { isActiveReseller, resellerBottomNav, resellerMore, resellerSidebar } from "@/lib/reseller/nav";

describe("reseller nav model (spec §3)", () => {
  it("has the 10 sidebar items in order", () => {
    expect(resellerSidebar.map((i) => i.label)).toEqual([
      "Dashboard", "Leads", "Customers", "Invoices", "Receipts",
      "Commissions", "Team", "Calendar", "Reports", "Settings",
    ]);
  });

  it("mobile bottom nav has 5 items ending in More", () => {
    expect(resellerBottomNav).toHaveLength(5);
    expect(resellerBottomNav.map((i) => i.label)).toEqual(["Home", "Leads", "Customers", "Invoices", "More"]);
  });

  it("the More sheet exposes the 6 secondary destinations", () => {
    expect(resellerMore.map((i) => i.label)).toEqual(["Team", "Calendar", "Reports", "Commissions", "Settings", "Profile"]);
  });
});

describe("isActiveReseller", () => {
  it("matches the section for nested routes", () => {
    expect(isActiveReseller("/reseller/leads/LEAD-1", "/reseller/leads")).toBe(true);
    expect(isActiveReseller("/reseller/customers", "/reseller/customers")).toBe(true);
    expect(isActiveReseller("/reseller/leads", "/reseller/customers")).toBe(false);
  });
  it("treats /reseller and /reseller/dashboard as Home", () => {
    expect(isActiveReseller("/reseller", "/reseller/dashboard")).toBe(true);
    expect(isActiveReseller("/reseller/dashboard", "/reseller/dashboard")).toBe(true);
    expect(isActiveReseller("/reseller/leads", "/reseller/dashboard")).toBe(false);
  });
});
