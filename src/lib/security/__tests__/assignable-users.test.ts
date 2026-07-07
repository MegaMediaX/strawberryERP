import { describe, expect, it } from "vitest";

import { resolvePortalSession } from "@/lib/portal-security";
import { assignableUsersFor, canAssignLeadTo } from "@/lib/security/assignable-users";

/**
 * §9: the add-lead "Assigned user" dropdown is scoped to who the acting user has
 * authority over (always including themselves). The server guard mirrors it.
 */

function userFor(userId: string) {
  const session = resolvePortalSession(
    new Request("https://x/api/frappe/leads", { headers: { "x-platform-user-id": userId } }),
  );
  return session.effectiveUser;
}

function names(userId: string) {
  return assignableUsersFor(userFor(userId))
    .map((u) => u.name)
    .sort();
}

describe("assignableUsersFor", () => {
  it("Super Admin can assign to every active user", () => {
    expect(names("USR-SUPER")).toEqual(["Beirut Reseller Admin", "Elie Mouawad", "Marven El Mouallem", "Maya Regional", "Super Admin"]);
  });

  it("Regional Director can assign to users in their countries", () => {
    // USR-REG-LB covers Lebanon + Jordan; all seed users operate in Lebanon.
    expect(names("USR-REG-LB")).toEqual(["Beirut Reseller Admin", "Elie Mouawad", "Marven El Mouallem", "Maya Regional"]);
  });

  it("Reseller Admin can assign only within their own reseller", () => {
    expect(names("USR-RESELLER-BDP")).toEqual(["Beirut Reseller Admin", "Elie Mouawad", "Marven El Mouallem"]);
  });

  it("Sales Team User can assign only to themselves", () => {
    expect(names("USR-SALES-RAMI")).toEqual(["Marven El Mouallem"]);
  });
});

describe("canAssignLeadTo", () => {
  const superAdmin = userFor("USR-SUPER");
  const reseller = userFor("USR-RESELLER-BDP");
  const sales = userFor("USR-SALES-RAMI");

  it("allows assigning to oneself", () => {
    expect(canAssignLeadTo(sales, "Marven El Mouallem")).toBe(true);
  });

  it("blocks a Sales Team User from assigning to someone else", () => {
    expect(canAssignLeadTo(sales, "Beirut Reseller Admin")).toBe(false);
  });

  it("blocks a Reseller Admin from assigning outside their reseller", () => {
    expect(canAssignLeadTo(reseller, "Maya Regional")).toBe(false);
  });

  it("allows a Reseller Admin to assign to their own team", () => {
    expect(canAssignLeadTo(reseller, "Marven El Mouallem")).toBe(true);
  });

  it("lets Super Admin assign to anyone", () => {
    expect(canAssignLeadTo(superAdmin, "Marven El Mouallem")).toBe(true);
  });

  it("passes empty assignee (required-field validation handles it)", () => {
    expect(canAssignLeadTo(sales, "")).toBe(true);
    expect(canAssignLeadTo(sales, undefined)).toBe(true);
  });

  it("defers unknown assignees to the backend (live Frappe users)", () => {
    expect(canAssignLeadTo(sales, "Some Live Frappe User")).toBe(true);
  });
});
