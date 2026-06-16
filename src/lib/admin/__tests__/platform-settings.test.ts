import { describe, expect, it } from "vitest";

import {
  defaultPlatformSettings,
  validateGeneral,
  validateLocalization,
  validateSecurity,
  validateSettingsSection,
} from "@/lib/admin/platform-settings";

describe("defaults (spec §37/38/39)", () => {
  it("all sections validate", () => {
    expect(validateSettingsSection("general", defaultPlatformSettings)).toBeNull();
    expect(validateSettingsSection("localization", defaultPlatformSettings)).toBeNull();
    expect(validateSettingsSection("security", defaultPlatformSettings)).toBeNull();
  });
});

describe("validateGeneral", () => {
  it("requires timezone + currency, validates email", () => {
    expect(validateGeneral({ ...defaultPlatformSettings.general, defaultTimezone: "" })).toMatch(/timezone/);
    expect(validateGeneral({ ...defaultPlatformSettings.general, defaultCurrency: "" })).toMatch(/currency/);
    expect(validateGeneral({ ...defaultPlatformSettings.general, supportEmail: "nope" })).toMatch(/email/);
  });
});

describe("validateLocalization (spec §38)", () => {
  it("requires ≥1 language + default among enabled", () => {
    expect(validateLocalization({ ...defaultPlatformSettings.localization, enabledLanguages: [] })).toMatch(/at least one language/i);
    expect(validateLocalization({ ...defaultPlatformSettings.localization, enabledLanguages: ["English"], defaultLanguage: "Arabic" })).toMatch(/default language/);
  });
});

describe("validateSecurity (spec §39)", () => {
  it("enforces password length, session timeout, IP format", () => {
    expect(validateSecurity({ ...defaultPlatformSettings.security, minPasswordLength: 6 })).toMatch(/password length/);
    expect(validateSecurity({ ...defaultPlatformSettings.security, sessionTimeoutMinutes: 1 })).toMatch(/Session timeout/);
    expect(validateSecurity({ ...defaultPlatformSettings.security, allowedIps: ["999.1.1.1"] })).toMatch(/valid IPv4/);
    expect(validateSecurity({ ...defaultPlatformSettings.security, allowedIps: ["203.0.113.10"] })).toBeNull();
  });
});
