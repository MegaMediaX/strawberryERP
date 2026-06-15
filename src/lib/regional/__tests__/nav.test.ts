import { describe, expect, it } from "vitest";

import { isActiveRegional, regionalBottomNav, regionalMore, regionalSidebar } from "@/lib/regional/nav";

describe("regional nav model (spec §4)", () => {
  it("has the 12 sidebar items in order", () => {
    expect(regionalSidebar.map((i) => i.label)).toEqual([
      "Dashboard", "Countries", "Resellers", "Leads", "Customers", "Invoices",
      "Receipts", "Commissions", "Calendar", "Reports", "Search", "Profile",
    ]);
  });

  it("mobile bottom nav has 5 items ending in More", () => {
    expect(regionalBottomNav).toHaveLength(5);
    expect(regionalBottomNav.map((i) => i.label)).toEqual(["Home", "Resellers", "Leads", "Reports", "More"]);
  });

  it("the More sheet exposes the 7 secondary destinations", () => {
    expect(regionalMore.map((i) => i.label)).toEqual(["Customers", "Invoices", "Receipts", "Commissions", "Calendar", "Search", "Profile"]);
  });
});

describe("isActiveRegional", () => {
  it("matches the section for nested routes", () => {
    expect(isActiveRegional("/regional/resellers/RES-1", "/regional/resellers")).toBe(true);
    expect(isActiveRegional("/regional/leads", "/regional/leads")).toBe(true);
    expect(isActiveRegional("/regional/leads", "/regional/customers")).toBe(false);
  });
  it("treats /regional and /regional/dashboard as Home", () => {
    expect(isActiveRegional("/regional", "/regional/dashboard")).toBe(true);
    expect(isActiveRegional("/regional/dashboard", "/regional/dashboard")).toBe(true);
  });
});
