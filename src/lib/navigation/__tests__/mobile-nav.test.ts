import { describe, expect, it } from "vitest";

import { fabForRole, isActiveMobile, mobileNavItems } from "@/lib/navigation/mobile-nav";

describe("mobileNavItems", () => {
  it("caps at 5 and gives operations roles the full set incl. Invoices", () => {
    const items = mobileNavItems("Super Admin");
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items.map((i) => i.href)).toContain("/accounting/invoices");
    expect(items.map((i) => i.href)).toContain("/");
  });

  it("hides Invoices from Sales Team User", () => {
    const hrefs = mobileNavItems("Sales Team User").map((i) => i.href);
    expect(hrefs).not.toContain("/accounting/invoices");
    expect(hrefs).toContain("/leads");
    expect(hrefs).toContain("/customers");
  });

  it("always includes Home and Security for every role", () => {
    for (const role of ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"] as const) {
      const hrefs = mobileNavItems(role).map((i) => i.href);
      expect(hrefs).toContain("/");
      expect(hrefs).toContain("/account/security");
    }
  });
});

describe("isActiveMobile", () => {
  it("matches the section for nested routes", () => {
    expect(isActiveMobile("/leads/LEAD-2408", "/leads")).toBe(true);
    expect(isActiveMobile("/customers", "/customers")).toBe(true);
    expect(isActiveMobile("/leads", "/customers")).toBe(false);
  });

  it("treats / and /dashboard as Home", () => {
    expect(isActiveMobile("/", "/")).toBe(true);
    expect(isActiveMobile("/dashboard", "/")).toBe(true);
    expect(isActiveMobile("/leads", "/")).toBe(false);
  });
});

describe("fabForRole", () => {
  it("shows New lead for lead-creating roles", () => {
    for (const role of ["Super Admin", "Reseller Admin", "Sales Team User"] as const) {
      expect(fabForRole(role)).toMatchObject({ show: true, href: "/leads" });
    }
  });

  it("hides the FAB for the read-only Regional Director", () => {
    expect(fabForRole("Regional Director").show).toBe(false);
  });
});
