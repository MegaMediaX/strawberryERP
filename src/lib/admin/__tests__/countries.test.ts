import { describe, expect, it } from "vitest";

import {
  defaultCountries,
  isBlockedCountryName,
  previewInvoiceNumber,
  validateCountryForm,
  type CountryFormContext,
} from "@/lib/admin/countries";

const ctx = (over: Partial<CountryFormContext> = {}): CountryFormContext => ({
  existingNames: ["Lebanon", "Cyprus", "Jordan", "Syria"],
  existingPrefixes: ["LB-INV", "CY-INV", "JO-INV", "SY-INV"],
  isEdit: false,
  ...over,
});

describe("isBlockedCountryName (spec §42)", () => {
  it("blocks Israel + its variants, case/space-insensitive", () => {
    for (const n of ["Israel", "israel", " ISRAEL ", "IL", "isr", "Occupied Palestine", "occupiedpalestine"]) {
      expect(isBlockedCountryName(n)).toBe(true);
    }
  });
  it("allows real regions", () => {
    for (const n of ["Lebanon", "Cyprus", "Jordan", "Syria", "Iraq", "Egypt"]) {
      expect(isBlockedCountryName(n)).toBe(false);
    }
  });
});

describe("validateCountryForm (spec §9)", () => {
  const good = { name: "Iraq", currency: "USD", timezone: "UTC", invoicePrefix: "IQ-INV" };
  it("accepts a complete, non-blocked, unique country", () => {
    expect(validateCountryForm(good, ctx())).toBeNull();
  });
  it("rejects a blocked country with the §42 message", () => {
    expect(validateCountryForm({ ...good, name: "Israel" }, ctx())).toMatch(/cannot be added/);
  });
  it("requires name, currency, timezone, prefix", () => {
    expect(validateCountryForm({ ...good, name: "" }, ctx())).toMatch(/name is required/);
    expect(validateCountryForm({ ...good, currency: "" }, ctx())).toMatch(/currency/);
    expect(validateCountryForm({ ...good, timezone: "" }, ctx())).toMatch(/timezone/);
    expect(validateCountryForm({ ...good, invoicePrefix: "" }, ctx())).toMatch(/prefix is required/);
  });
  it("rejects a bad prefix + duplicate name/prefix on create", () => {
    expect(validateCountryForm({ ...good, invoicePrefix: "bad prefix!" }, ctx())).toMatch(/A–Z, 0–9/);
    expect(validateCountryForm({ ...good, name: "Lebanon" }, ctx())).toMatch(/already exists/);
    expect(validateCountryForm({ ...good, invoicePrefix: "LB-INV" }, ctx())).toMatch(/already uses this invoice prefix/);
  });
  it("allows the same name/prefix when editing", () => {
    expect(validateCountryForm({ name: "Lebanon", currency: "USD", timezone: "Asia/Beirut", invoicePrefix: "LB-INV" }, ctx({ isEdit: true }))).toBeNull();
  });
});

describe("previewInvoiceNumber (spec §9)", () => {
  it("renders PREFIX-0001", () => {
    expect(previewInvoiceNumber("LB-INV")).toBe("LB-INV-0001");
    expect(previewInvoiceNumber("cy-inv", 42)).toBe("CY-INV-0042");
    expect(previewInvoiceNumber("")).toBe("INV-0001");
  });
});

describe("defaultCountries", () => {
  it("seeds the four approved regions, all active", () => {
    const d = defaultCountries();
    expect(d.map((c) => c.name)).toEqual(["Lebanon", "Cyprus", "Jordan", "Syria"]);
    expect(d.every((c) => c.active)).toBe(true);
  });
});
