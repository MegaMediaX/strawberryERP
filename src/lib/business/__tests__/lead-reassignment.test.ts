import { describe, expect, it } from "vitest";

import { eligibleAssignees, validateReassignment } from "@/lib/business/lead-reassignment";
import type { PortalUser } from "@/lib/portal-security";
import type { PortalLead } from "@/lib/ui-data";

const users: PortalUser[] = [
  { id: "USR-SUPER", name: "Super Admin", email: "s@x", role: "Super Admin", countries: ["Lebanon", "Cyprus", "Jordan", "Syria"], active: true },
  { id: "USR-REG-LB", name: "Maya Regional", email: "m@x", role: "Regional Director", countries: ["Lebanon", "Jordan"], active: true },
  { id: "USR-RES-BDP", name: "BDP Admin", email: "a@x", role: "Reseller Admin", countries: ["Lebanon"], reseller: "Beirut Digital Partners", active: true },
  { id: "USR-SALES-RAMI", name: "Marven El Mouallem", email: "r@x", role: "Sales Team User", countries: ["Lebanon"], reseller: "Beirut Digital Partners", active: true },
  { id: "USR-SALES-OTHER", name: "Other Reseller Sales", email: "o@x", role: "Sales Team User", countries: ["Lebanon"], reseller: "Other Reseller", active: true },
  { id: "USR-INACTIVE", name: "Inactive", email: "i@x", role: "Sales Team User", countries: ["Lebanon"], reseller: "Beirut Digital Partners", active: false },
  { id: "USR-CY", name: "Cyprus Sales", email: "c@x", role: "Sales Team User", countries: ["Cyprus"], reseller: "Beirut Digital Partners", active: true },
];

function lead(overrides: Partial<PortalLead> = {}): PortalLead {
  return {
    id: "LEAD-2408",
    company: "Cedar Cloud",
    contact: "Maya",
    gender: "Female",
    country: "Lebanon",
    reseller: "Beirut Digital Partners",
    assignedTo: "m.elmouallem@leb-tech.com",
    phone: "+961",
    email: "m@x",
    priority: "High",
    status: "Contacted (Interested)",
    followUp: "",
    source: "WhatsApp",
    notes: "",
    ...overrides,
  } as PortalLead;
}

const byId = (id: string) => users.find((u) => u.id === id)!;

describe("eligibleAssignees", () => {
  it("Super Admin sees active users in the lead's country and reseller (or unscoped overseers)", () => {
    const ids = eligibleAssignees(lead(), byId("USR-SUPER"), users).map((u) => u.id);
    expect(ids).toContain("USR-SALES-RAMI"); // same reseller, Lebanon
    expect(ids).toContain("USR-REG-LB"); // director, no reseller, covers Lebanon
    expect(ids).not.toContain("USR-SALES-OTHER"); // different reseller
    expect(ids).not.toContain("USR-INACTIVE"); // inactive
    expect(ids).not.toContain("USR-CY"); // wrong country
  });

  it("Reseller Admin only sees users in their own reseller", () => {
    const ids = eligibleAssignees(lead(), byId("USR-RES-BDP"), users).map((u) => u.id);
    expect(ids).toContain("USR-SALES-RAMI");
    expect(ids).not.toContain("USR-REG-LB"); // director has no reseller → outside admin's reseller scope
    expect(ids).not.toContain("USR-SALES-OTHER");
  });

  it("Regional Director is limited to users covering their countries", () => {
    const ids = eligibleAssignees(lead(), byId("USR-REG-LB"), users).map((u) => u.id);
    expect(ids).toContain("USR-SALES-RAMI"); // Lebanon
    expect(ids).not.toContain("USR-CY"); // wrong country anyway
  });

  it("Sales Team User cannot reassign (no candidates)", () => {
    expect(eligibleAssignees(lead(), byId("USR-SALES-RAMI"), users)).toEqual([]);
  });
});

describe("validateReassignment", () => {
  it("accepts an eligible target", () => {
    expect(validateReassignment(lead(), "USR-SALES-RAMI", byId("USR-SUPER"), users)).toBeNull();
  });

  it("rejects a cross-reseller target", () => {
    expect(validateReassignment(lead(), "USR-SALES-OTHER", byId("USR-SUPER"), users)).toMatch(/not eligible/i);
  });

  it("rejects when the acting role cannot reassign", () => {
    expect(validateReassignment(lead(), "USR-SALES-RAMI", byId("USR-SALES-RAMI"), users)).toMatch(/cannot reassign/i);
  });

  it("requires a target selection", () => {
    expect(validateReassignment(lead(), "", byId("USR-SUPER"), users)).toMatch(/select a user/i);
  });
});
