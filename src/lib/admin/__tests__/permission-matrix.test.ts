import { describe, expect, it } from "vitest";

import {
  canManage,
  canView,
  defaultPermissionMatrix,
  impactPreview,
  MANAGED_ROLES,
  PERMISSION_GROUPS,
  resolveCapability,
  validatePermissionMatrix,
  type PermissionMatrix,
} from "@/lib/admin/permission-matrix";

describe("permission matrix shape (spec §44)", () => {
  it("covers the §44 groups + managed roles (Super Admin excluded)", () => {
    expect(PERMISSION_GROUPS).toContain("Leads");
    expect(PERMISSION_GROUPS).toContain("API");
    expect(MANAGED_ROLES).not.toContain("Super Admin" as never);
  });
  it("defaults validate", () => {
    expect(validatePermissionMatrix(defaultPermissionMatrix)).toBeNull();
  });
});

describe("resolveCapability + canView/canManage", () => {
  it("reads a capability", () => {
    expect(resolveCapability(defaultPermissionMatrix, "Reseller Admin", "Leads")).toBe("Manage");
    expect(resolveCapability(defaultPermissionMatrix, "Regional Director", "Leads")).toBe("View");
    expect(resolveCapability(defaultPermissionMatrix, "Sales Team User", "Settings")).toBe("None");
  });
  it("derives view/manage", () => {
    expect(canView("View")).toBe(true);
    expect(canView("Manage")).toBe(true);
    expect(canView("None")).toBe(false);
    expect(canManage("Manage")).toBe(true);
    expect(canManage("View")).toBe(false);
  });
});

describe("validatePermissionMatrix", () => {
  it("rejects an invalid capability", () => {
    const bad = JSON.parse(JSON.stringify(defaultPermissionMatrix)) as PermissionMatrix;
    (bad["Sales Team User"] as Record<string, string>).Leads = "Delete";
    expect(validatePermissionMatrix(bad)).toMatch(/Invalid capability/);
  });
});

describe("impactPreview (spec §44)", () => {
  it("summarises in plain language", () => {
    const lines = impactPreview(defaultPermissionMatrix, "Reseller Admin");
    expect(lines.some((l) => /Can create \+ edit: .*Leads/.test(l))).toBe(true);
    expect(lines.some((l) => /Can view \(read-only\)/.test(l))).toBe(true);
    expect(lines.some((l) => /No access to:/.test(l))).toBe(true);
  });
  it("handles a fully-locked role", () => {
    const locked = JSON.parse(JSON.stringify(defaultPermissionMatrix)) as PermissionMatrix;
    for (const g of PERMISSION_GROUPS) locked["Sales Team User"][g] = "None";
    expect(impactPreview(locked, "Sales Team User")).toContain("This role currently has no access to anything.");
  });
});
