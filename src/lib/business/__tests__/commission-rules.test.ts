import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/[...resource]/route";
import {
  commissionAppliesTo,
  commissionTriggers,
  validateCommissionRule,
} from "@/lib/business/commission-rules";

/**
 * Commission rule validation + create route (§3 / §9).
 */

const valid = {
  reseller: "Beirut Digital Partners",
  country: "Lebanon" as const,
  commissionPercentage: 10,
  triggerCondition: "Invoice Created" as const,
  appliesTo: "Invoice Total" as const,
};

describe("validateCommissionRule", () => {
  it("accepts a well-formed rule across all triggers and appliesTo", () => {
    for (const triggerCondition of commissionTriggers) {
      expect(validateCommissionRule({ ...valid, triggerCondition })).toBeNull();
    }
    for (const appliesTo of commissionAppliesTo) {
      expect(validateCommissionRule({ ...valid, appliesTo })).toBeNull();
    }
  });

  it("requires a reseller", () => {
    expect(validateCommissionRule({ ...valid, reseller: "  " })).toMatch(/reseller is required/i);
  });

  it("applies the country block", () => {
    expect(validateCommissionRule({ ...valid, country: "Israel" as never })).toMatch(/not enabled/);
  });

  it("bounds the percentage to (0, 100]", () => {
    expect(validateCommissionRule({ ...valid, commissionPercentage: 0 })).toMatch(/percentage/);
    expect(validateCommissionRule({ ...valid, commissionPercentage: 150 })).toMatch(/percentage/);
    expect(validateCommissionRule({ ...valid, commissionPercentage: 100 })).toBeNull();
  });

  it("rejects an unknown trigger condition", () => {
    expect(validateCommissionRule({ ...valid, triggerCondition: "Refunded" as never })).toMatch(/Trigger condition/);
  });
});

function post(body: Record<string, unknown>) {
  const resource = ["commissions", "rules"];
  return POST(
    new Request("https://portal.local/api/frappe/commissions/rules", {
      method: "POST",
      headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource }) },
  );
}

describe("POST commissions/rules", () => {
  it("accepts a valid payload but is honest that it isn't persisted (no structured dev-store yet, P0-1)", async () => {
    const res = await post(valid);
    expect(res.status).toBe(202);
    const body = (await res.json()) as { persisted: boolean; note: string };
    expect(body.persisted).toBe(false);
    expect(body.note).toMatch(/mock until Frappe migration/i);
  });

  it("rejects an invalid percentage (400)", async () => {
    expect((await post({ ...valid, commissionPercentage: 0 })).status).toBe(400);
  });

  it("rejects a blocked country (400)", async () => {
    expect((await post({ ...valid, country: "Israel" })).status).toBe(400);
  });
});
