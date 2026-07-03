import { describe, expect, it } from "vitest";

import {
  adminBottomNav,
  adminMore,
  adminSidebar,
  adminSidebarItems,
  isActiveAdmin,
} from "@/lib/admin/nav";

describe("admin nav model (spec §4)", () => {
  it("has the 6 sidebar groups in order", () => {
    expect(adminSidebar.map((g) => g.label)).toEqual([
      "Dashboard", "Operations", "Partners", "Accounting", "Reports", "Platform",
    ]);
  });

  it("Operations / Partners / Accounting / Platform hold the spec items", () => {
    const byGroup = Object.fromEntries(adminSidebar.map((g) => [g.label, g.items.map((i) => i.label)]));
    expect(byGroup.Operations).toEqual(["Leads", "Customers", "Invoices", "Receipts", "Calendar"]);
    expect(byGroup.Partners).toEqual(["Countries", "Resellers", "Users", "Commissions"]);
    expect(byGroup.Accounting).toEqual(["Invoicing", "Currencies", "Payment Methods", "Expenses", "P&L"]);
    expect(byGroup.Reports).toEqual(["Reports", "Call Center"]);
    expect(byGroup.Platform).toEqual([
      "Exhibition Floor", "White Label", "Branding", "Custom Fields", "Notifications",
      "API Developer Center", "Integrations", "Delete Queue", "Audit Logs", "Settings",
    ]);
  });

  it("every sidebar href is unique and under /admin", () => {
    const hrefs = adminSidebarItems.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h.startsWith("/admin/"))).toBe(true);
  });

  it("mobile bottom nav has 5 items ending in More", () => {
    expect(adminBottomNav).toHaveLength(5);
    expect(adminBottomNav.map((i) => i.label)).toEqual(["Home", "Operations", "Partners", "Reports", "More"]);
    expect(adminBottomNav.at(-1)!.href).toBe("#more");
  });

  it("the More sheet exposes the 7 secondary destinations (§4)", () => {
    expect(adminMore.map((i) => i.label)).toEqual([
      "Accounting", "Integrations", "API", "Settings", "Audit Logs", "Delete Queue", "Profile",
    ]);
  });

  it("urgent badge slots are wired on the right items (§4)", () => {
    const badged = adminSidebarItems.filter((i) => i.badge);
    expect(badged.map((i) => `${i.label}:${i.badge}`).sort()).toEqual([
      "API Developer Center:apiErrors",
      "Delete Queue:deleteQueue",
      "Integrations:integrationErrors",
      "Invoices:overdueInvoices",
    ]);
  });
});

describe("isActiveAdmin", () => {
  it("treats /admin and /admin/dashboard as Home", () => {
    expect(isActiveAdmin("/admin", "/admin/dashboard")).toBe(true);
    expect(isActiveAdmin("/admin/dashboard", "/admin/dashboard")).toBe(true);
  });
  it("matches the section for nested routes", () => {
    expect(isActiveAdmin("/admin/resellers/RES-1", "/admin/resellers")).toBe(true);
    expect(isActiveAdmin("/admin/accounting/invoicing", "/admin/accounting/invoicing")).toBe(true);
    expect(isActiveAdmin("/admin/leads", "/admin/customers")).toBe(false);
  });
  it("does not mark the dashboard active on other routes", () => {
    expect(isActiveAdmin("/admin/leads", "/admin/dashboard")).toBe(false);
  });
});
