import { describe, expect, it } from "vitest";

import {
  adminCreatableRoles,
  buildUser,
  roleRequiresCountry,
  roleRequiresReseller,
  validateAdminUser,
  validatePasswordReset,
  type AdminUserFormContext,
  type AdminUserFormInput,
} from "@/lib/admin/users";

const ctx = (over: Partial<AdminUserFormContext> = {}): AdminUserFormContext => ({
  existingEmails: ["taken@lebtech.example"],
  isEdit: false,
  ...over,
});

const base: AdminUserFormInput = {
  firstName: "Lina", lastName: "Saad", email: "lina@lebtech.example", phone: "+961",
  role: "Regional Director", countries: ["Lebanon"], reseller: "", password: "Str0ngPass!",
};

describe("adminCreatableRoles (spec §11)", () => {
  it("a Super Admin can create the 3 lower roles, never another Super Admin", () => {
    expect(adminCreatableRoles().sort()).toEqual(["Regional Director", "Reseller Admin", "Sales Team User"]);
  });
});

describe("role-aware scope rules", () => {
  it("country/reseller requirements per role", () => {
    expect(roleRequiresCountry("Regional Director")).toBe(true);
    expect(roleRequiresCountry("Reseller Admin")).toBe(false);
    expect(roleRequiresReseller("Sales Team User")).toBe(true);
    expect(roleRequiresReseller("Regional Director")).toBe(false);
  });
});

describe("validateAdminUser", () => {
  it("accepts a complete regional director", () => {
    expect(validateAdminUser(base, ctx())).toBeNull();
  });
  it("requires name, valid+unique email, role", () => {
    expect(validateAdminUser({ ...base, firstName: "" }, ctx())).toMatch(/first and last name/);
    expect(validateAdminUser({ ...base, email: "bad" }, ctx())).toMatch(/valid email/);
    expect(validateAdminUser({ ...base, email: "taken@lebtech.example" }, ctx())).toMatch(/already exists/);
    expect(validateAdminUser({ ...base, role: "" }, ctx())).toMatch(/Select a role/);
  });
  it("blocks creating a Super Admin", () => {
    expect(validateAdminUser({ ...base, role: "Super Admin" }, ctx())).toMatch(/can't be created/);
  });
  it("enforces role-aware scope", () => {
    expect(validateAdminUser({ ...base, role: "Regional Director", countries: [] }, ctx())).toMatch(/at least one country/);
    expect(validateAdminUser({ ...base, role: "Reseller Admin", reseller: "" }, ctx())).toMatch(/assigned to a reseller/);
    expect(validateAdminUser({ ...base, role: "Sales Team User", reseller: "BDP", countries: [] }, ctx())).toMatch(/at least one country/);
  });
  it("requires a password on create, not on edit", () => {
    expect(validateAdminUser({ ...base, password: "short" }, ctx())).toMatch(/at least 8/);
    expect(validateAdminUser({ ...base, password: "" }, ctx({ isEdit: true }))).toBeNull();
  });
});

describe("validatePasswordReset", () => {
  it("enforces min length", () => {
    expect(validatePasswordReset("short")).toMatch(/at least 8/);
    expect(validatePasswordReset("longenough")).toBeNull();
  });
});

describe("buildUser", () => {
  it("builds a sales user scoped to reseller + countries", () => {
    const u = buildUser({ ...base, role: "Sales Team User", reseller: "Beirut Digital Partners", countries: ["Lebanon"] }, "X1");
    expect(u).toMatchObject({ id: "USR-X1", name: "Lina Saad", role: "Sales Team User", reseller: "Beirut Digital Partners", countries: ["Lebanon"], active: true });
  });
  it("drops reseller for a regional director", () => {
    expect(buildUser(base, "X2").reseller).toBeUndefined();
  });
});
