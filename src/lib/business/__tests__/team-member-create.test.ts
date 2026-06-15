import { describe, expect, it } from "vitest";

import { creatableRoles, validateNewTeamMember, type NewTeamMemberInput } from "@/lib/business/team-member-create";
import type { PortalUser } from "@/lib/portal-security";

const resellerAdmin: PortalUser = {
  id: "USR-RA", name: "Beirut Reseller Admin", email: "admin@bdp.example", role: "Reseller Admin",
  countries: ["Lebanon"], reseller: "Beirut Digital Partners", active: true,
};

const input = (over: Partial<NewTeamMemberInput> = {}): NewTeamMemberInput => ({
  name: "New Rep", email: "rep@bdp.example", role: "Sales Team User", countries: ["Lebanon"], password: "passw0rd", ...over,
});

describe("creatableRoles — strictly below (spec §22)", () => {
  it("Reseller Admin → only Sales Team User", () => {
    expect(creatableRoles("Reseller Admin")).toEqual(["Sales Team User"]);
  });
  it("Regional Director → Sales Team User + Reseller Admin", () => {
    expect(creatableRoles("Regional Director").sort()).toEqual(["Reseller Admin", "Sales Team User"]);
  });
  it("Super Admin → everyone below; Sales Team User → nobody", () => {
    expect(creatableRoles("Super Admin")).toHaveLength(3);
    expect(creatableRoles("Sales Team User")).toEqual([]);
  });
});

describe("validateNewTeamMember (spec §22)", () => {
  it("accepts a Reseller Admin creating a Sales Team User in their country", () => {
    expect(validateNewTeamMember(input(), resellerAdmin)).toBeNull();
  });

  it("REJECTS creating a peer or higher role (the core rule)", () => {
    expect(validateNewTeamMember(input({ role: "Reseller Admin" }), resellerAdmin)).toMatch(/below your own/);
    expect(validateNewTeamMember(input({ role: "Regional Director" }), resellerAdmin)).toMatch(/below your own/);
    expect(validateNewTeamMember(input({ role: "Super Admin" }), resellerAdmin)).toMatch(/below your own/);
  });

  it("rejects a country outside the creator's scope", () => {
    expect(validateNewTeamMember(input({ countries: ["Cyprus"] }), resellerAdmin)).toMatch(/outside your countries/);
  });

  it("rejects bad email, missing role, short password", () => {
    expect(validateNewTeamMember(input({ email: "nope" }), resellerAdmin)).toMatch(/valid email/);
    expect(validateNewTeamMember(input({ role: "" }), resellerAdmin)).toMatch(/Select a role/);
    expect(validateNewTeamMember(input({ password: "short" }), resellerAdmin)).toMatch(/at least 8/);
  });

  it("a Sales Team User can create nobody", () => {
    const sales: PortalUser = { ...resellerAdmin, role: "Sales Team User" };
    expect(validateNewTeamMember(input(), sales)).toMatch(/below your own/);
  });
});
