import { describe, expect, it } from "vitest";

import {
  brandingModeLabel,
  resellerCommissionLabel,
  resolveResellerAdmin,
  validateLoginAsReason,
  type UserLike,
} from "@/lib/admin/resellers";

const users: UserLike[] = [
  { id: "U1", name: "Beirut Reseller Admin", role: "Reseller Admin", reseller: "Beirut Digital Partners", active: true },
  { id: "U2", name: "Rami Sales", role: "Sales Team User", reseller: "Beirut Digital Partners", active: true },
  { id: "U3", name: "Inactive Admin", role: "Reseller Admin", reseller: "Sham Partner Desk", active: false },
];

describe("resellerCommissionLabel (spec §10)", () => {
  it("formats percent + trigger", () => {
    expect(resellerCommissionLabel({ defaultCommissionPercentage: 12, defaultCommissionTrigger: "Fully Paid" })).toBe("12% on Fully Paid");
  });
});

describe("brandingModeLabel", () => {
  it("defaults to Global pending the white-label slice", () => {
    expect(brandingModeLabel()).toBe("Global");
  });
});

describe("resolveResellerAdmin (spec §12)", () => {
  it("finds the active reseller admin for a reseller", () => {
    expect(resolveResellerAdmin(users, "Beirut Digital Partners")?.id).toBe("U1");
  });
  it("returns null when the only admin is inactive or none exists", () => {
    expect(resolveResellerAdmin(users, "Sham Partner Desk")).toBeNull();
    expect(resolveResellerAdmin(users, "Nonexistent")).toBeNull();
  });
});

describe("validateLoginAsReason (spec §12)", () => {
  it("requires a non-empty reason ≤ 200 chars", () => {
    expect(validateLoginAsReason("")).toMatch(/reason is required/);
    expect(validateLoginAsReason("   ")).toMatch(/reason is required/);
    expect(validateLoginAsReason("x".repeat(201))).toMatch(/200 characters/);
    expect(validateLoginAsReason("Investigating a billing issue")).toBeNull();
  });
});
