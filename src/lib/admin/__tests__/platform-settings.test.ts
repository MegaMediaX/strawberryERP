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
  const general = (defaultTimezone: string) => ({ ...defaultPlatformSettings.general, defaultTimezone });

  it("requires timezone + currency, validates email", () => {
    expect(validateGeneral({ ...defaultPlatformSettings.general, defaultTimezone: "" })).toMatch(/timezone/);
    expect(validateGeneral({ ...defaultPlatformSettings.general, defaultCurrency: "" })).toMatch(/currency/);
    expect(validateGeneral({ ...defaultPlatformSettings.general, supportEmail: "nope" })).toMatch(/email/);
  });

  /**
   * The settings field is free text, and every formatter downstream falls back to
   * UTC on an unknown zone rather than throwing. So a zone that gets past here is
   * never reported anywhere — it just silently shifts hold expiry by the offset.
   * This boundary is the only thing that can catch it.
   */
  it("rejects a zone Intl does not recognise", () => {
    expect(validateGeneral(general("Not/AZone"))).toMatch(/not a valid IANA time zone/);
    expect(validateGeneral(general("Mars/Olympus_Mons"))).toMatch(/not a valid IANA time zone/);
  });

  it("rejects a plausible typo of a real zone", () => {
    // The realistic failure: an admin fat-fingers the field and nothing complains.
    expect(validateGeneral(general("Asia/Beriut"))).toMatch(/not a valid IANA time zone/);
  });

  it("rejects untrimmed input, because the raw value is what gets stored", () => {
    // " Asia/Beirut" trims to something valid but is handed to Intl verbatim later.
    expect(validateGeneral(general(" Asia/Beirut"))).toMatch(/not a valid IANA time zone/);
    expect(validateGeneral(general("Asia/Beirut "))).toMatch(/not a valid IANA time zone/);
  });

  it("names the offending value so the admin can see the typo", () => {
    expect(validateGeneral(general("Asia/Beriut"))).toContain("Asia/Beriut");
  });

  it("accepts real zones", () => {
    for (const tz of ["Asia/Beirut", "UTC", "Europe/Paris", "America/New_York", "Asia/Nicosia"]) {
      expect(validateGeneral(general(tz))).toBeNull();
    }
  });

  it("accepts spellings Intl accepts, since the app handles them fine", () => {
    // Not checked against a hardcoded list: Intl normalises these and every
    // formatter downstream resolves them correctly, so rejecting them would be
    // stricter than the app actually requires.
    expect(validateGeneral(general("utc"))).toBeNull();
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
