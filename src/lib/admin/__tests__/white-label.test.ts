import { describe, expect, it } from "vitest";

import {
  brandingScopeSummary,
  defaultWhiteLabel,
  isValidHexColor,
  mergeWhiteLabel,
  PLATFORM_MODULES,
  validateWhiteLabel,
} from "@/lib/admin/white-label";

describe("isValidHexColor", () => {
  it("accepts 3- and 6-digit hex", () => {
    expect(isValidHexColor("#fff")).toBe(true);
    expect(isValidHexColor("#4f46e5")).toBe(true);
  });
  it("rejects non-hex", () => {
    expect(isValidHexColor("blue")).toBe(false);
    expect(isValidHexColor("#12")).toBe(false);
    expect(isValidHexColor("4f46e5")).toBe(false);
  });
});

describe("validateWhiteLabel (spec §30)", () => {
  it("passes for defaults", () => {
    expect(validateWhiteLabel(defaultWhiteLabel)).toBeNull();
  });
  it("requires a platform name", () => {
    expect(validateWhiteLabel({ ...defaultWhiteLabel, platformName: "" })).toMatch(/Platform name/);
  });
  it("rejects invalid colors", () => {
    expect(validateWhiteLabel({ ...defaultWhiteLabel, primaryColor: "red" })).toMatch(/Primary color/);
    expect(validateWhiteLabel({ ...defaultWhiteLabel, secondaryColor: "nope" })).toMatch(/Secondary color/);
  });
  it("rejects unknown modules + empty module set", () => {
    expect(validateWhiteLabel({ ...defaultWhiteLabel, enabledModules: ["Wizards"] })).toMatch(/Unknown module/);
    expect(validateWhiteLabel({ ...defaultWhiteLabel, enabledModules: [] })).toMatch(/At least one module/);
  });
});

describe("mergeWhiteLabel", () => {
  it("applies a patch + copies the module array", () => {
    const next = mergeWhiteLabel(defaultWhiteLabel, { platformName: "Acme", enabledModules: ["Leads"] });
    expect(next.platformName).toBe("Acme");
    expect(next.enabledModules).toEqual(["Leads"]);
    expect(next.primaryColor).toBe(defaultWhiteLabel.primaryColor);
  });
  it("keeps current modules when patch omits them", () => {
    const next = mergeWhiteLabel(defaultWhiteLabel, { logoUrl: "x.png" });
    expect(next.enabledModules).toEqual([...PLATFORM_MODULES]);
  });
});

describe("brandingScopeSummary", () => {
  it("reflects which tenant scopes can override branding", () => {
    expect(brandingScopeSummary({ allowResellerBranding: true, allowCountryBranding: true })).toBe("Global → Country → Reseller");
    expect(brandingScopeSummary({ allowResellerBranding: false, allowCountryBranding: false })).toBe("Global");
    expect(brandingScopeSummary({ allowResellerBranding: true, allowCountryBranding: false })).toBe("Global → Reseller");
  });
});
