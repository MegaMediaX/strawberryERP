import { describe, expect, it } from "vitest";

import {
  canApproveCommission,
  evaluateCommissionApproval,
  validateCommissionStatusTransition,
  type CommissionApprover,
} from "@/lib/business/commission-approval";

const entry = { country: "Lebanon" as const, reseller: "Beirut Digital Partners", status: "Pending" as const };

const sup: CommissionApprover = { role: "Super Admin", countries: ["Lebanon", "Cyprus", "Jordan", "Syria"] };
const regLB: CommissionApprover = { role: "Regional Director", countries: ["Lebanon", "Jordan"] };
const regCY: CommissionApprover = { role: "Regional Director", countries: ["Cyprus"] };
const resBDP: CommissionApprover = { role: "Reseller Admin", countries: ["Lebanon"], reseller: "Beirut Digital Partners" };
const resOther: CommissionApprover = { role: "Reseller Admin", countries: ["Lebanon"], reseller: "Other Reseller" };
const sales: CommissionApprover = { role: "Sales Team User", countries: ["Lebanon"], reseller: "Beirut Digital Partners" };

describe("validateCommissionStatusTransition", () => {
  it("allows Pending→Approved, Approved→Paid, and any→Cancelled", () => {
    expect(validateCommissionStatusTransition("Pending", "Approved")).toBeNull();
    expect(validateCommissionStatusTransition("Approved", "Paid")).toBeNull();
    expect(validateCommissionStatusTransition("Pending", "Cancelled")).toBeNull();
    expect(validateCommissionStatusTransition("Approved", "Cancelled")).toBeNull();
  });

  it("rejects skips and moves out of terminal states", () => {
    expect(validateCommissionStatusTransition("Pending", "Paid")).toMatch(/Cannot move/);
    expect(validateCommissionStatusTransition("Paid", "Approved")).toMatch(/Cannot move/);
    expect(validateCommissionStatusTransition("Cancelled", "Approved")).toMatch(/Cannot move/);
    expect(validateCommissionStatusTransition("Approved", "Approved")).toMatch(/already/);
  });
});

describe("canApproveCommission", () => {
  it("Super Admin can approve any entry", () => {
    expect(canApproveCommission(sup, entry)).toBe(true);
  });
  it("Regional Director only within their countries", () => {
    expect(canApproveCommission(regLB, entry)).toBe(true);
    expect(canApproveCommission(regCY, entry)).toBe(false);
  });
  it("Reseller Admin only for their own reseller", () => {
    expect(canApproveCommission(resBDP, entry)).toBe(true);
    expect(canApproveCommission(resOther, entry)).toBe(false);
  });
  it("Sales Team User never", () => {
    expect(canApproveCommission(sales, entry)).toBe(false);
  });
});

describe("evaluateCommissionApproval", () => {
  it("returns ok for an authorized, valid transition", () => {
    expect(evaluateCommissionApproval(resBDP, entry, "Approved")).toEqual({ ok: true });
  });
  it("returns 403 before checking the transition when unauthorized", () => {
    expect(evaluateCommissionApproval(resOther, entry, "Approved")).toEqual({
      ok: false,
      error: expect.stringMatching(/not allowed/i),
      status: 403,
    });
  });
  it("returns 400 for an authorized but invalid transition", () => {
    const res = evaluateCommissionApproval(sup, entry, "Paid");
    expect(res).toMatchObject({ ok: false, status: 400 });
  });
});
