import { describe, expect, it } from "vitest";

import { defaultResellers, validateReseller, type Reseller } from "@/lib/business/reseller-defaults";

const CURRENCIES = ["USD", "EUR", "JOD", "SYP", "LBP"];

function reseller(overrides: Partial<Reseller> = {}): Reseller {
  return {
    name: "Acme Partners",
    countries: ["Lebanon"],
    defaultCurrency: "USD",
    defaultCommissionPercentage: 12,
    defaultCommissionTrigger: "Fully Paid",
    visibility: "Assigned Countries",
    isActive: true,
    ...overrides,
  };
}

describe("validateReseller", () => {
  it("accepts a valid reseller", () => {
    expect(validateReseller(reseller(), CURRENCIES)).toBeNull();
  });

  it("accepts the seeded defaults", () => {
    for (const r of defaultResellers) {
      expect(validateReseller(r, CURRENCIES)).toBeNull();
    }
  });

  it("requires a name and at least one country", () => {
    expect(validateReseller(reseller({ name: " " }), CURRENCIES)).toMatch(/name/i);
    expect(validateReseller(reseller({ countries: [] }), CURRENCIES)).toMatch(/at least one country/i);
  });

  it("blocks an assigned blocked country", () => {
    expect(validateReseller(reseller({ countries: ["Israel" as never] }), CURRENCIES)).toMatch(/not enabled|blocked/i);
  });

  it("requires the default currency to be an active currency", () => {
    expect(validateReseller(reseller({ defaultCurrency: "XYZ" }), CURRENCIES)).toMatch(/active platform currency/i);
  });

  it("bounds commission percentage to 0–100", () => {
    expect(validateReseller(reseller({ defaultCommissionPercentage: -1 }), CURRENCIES)).toMatch(/between 0 and 100/i);
    expect(validateReseller(reseller({ defaultCommissionPercentage: 150 }), CURRENCIES)).toMatch(/between 0 and 100/i);
    expect(validateReseller(reseller({ defaultCommissionPercentage: 0 }), CURRENCIES)).toBeNull();
    expect(validateReseller(reseller({ defaultCommissionPercentage: 100 }), CURRENCIES)).toBeNull();
  });

  it("rejects an invalid trigger and visibility", () => {
    expect(validateReseller(reseller({ defaultCommissionTrigger: "Whenever" as never }), CURRENCIES)).toMatch(/trigger/i);
    expect(validateReseller(reseller({ visibility: "Everywhere" as never }), CURRENCIES)).toMatch(/visibility/i);
  });
});
