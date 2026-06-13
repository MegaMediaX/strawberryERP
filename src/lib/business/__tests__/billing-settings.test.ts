import { describe, expect, it } from "vitest";

import {
  invoiceNumberingModes,
  validateCurrencySetting,
  validateInvoiceNumbering,
} from "@/lib/business/billing-settings";

/**
 * Billing settings validation — currency + invoice numbering (§3 / §9).
 */

const validCurrency = {
  currencyCode: "USD",
  currencyName: "US Dollar",
  symbol: "$",
  decimalPrecision: 2,
  manualExchangeRate: 1,
  assignedCountries: ["Lebanon" as never],
};

describe("validateCurrencySetting", () => {
  it("accepts a well-formed currency", () => {
    expect(validateCurrencySetting(validCurrency)).toBeNull();
  });

  it("requires a 3-letter ISO code", () => {
    expect(validateCurrencySetting({ ...validCurrency, currencyCode: "usd" })).toMatch(/3-letter ISO/);
    expect(validateCurrencySetting({ ...validCurrency, currencyCode: "DOLLAR" })).toMatch(/3-letter ISO/);
  });

  it("bounds decimal precision to 0..4", () => {
    expect(validateCurrencySetting({ ...validCurrency, decimalPrecision: 5 })).toMatch(/Decimal precision/);
    expect(validateCurrencySetting({ ...validCurrency, decimalPrecision: -1 })).toMatch(/Decimal precision/);
    expect(validateCurrencySetting({ ...validCurrency, decimalPrecision: 0 })).toBeNull();
  });

  it("requires a positive exchange rate when provided", () => {
    expect(validateCurrencySetting({ ...validCurrency, manualExchangeRate: 0 })).toMatch(/exchange rate/);
  });

  it("rejects a blocked country in the currency's assignments (country block holds)", () => {
    expect(
      validateCurrencySetting({ ...validCurrency, assignedCountries: ["Israel" as never] }),
    ).toMatch(/Country is not enabled/);
  });
});

describe("validateInvoiceNumbering", () => {
  it("accepts the supported modes", () => {
    for (const mode of invoiceNumberingModes) {
      expect(validateInvoiceNumbering({ mode })).toBeNull();
    }
  });

  it("rejects an unknown mode", () => {
    expect(validateInvoiceNumbering({ mode: "Sequential-XYZ" })).toMatch(/Numbering mode must be one of/);
  });

  it("validates a custom country prefix is 2-4 letters", () => {
    expect(validateInvoiceNumbering({ mode: "Country Prefix", prefix: "L" })).toMatch(/2-4 letters/);
    expect(validateInvoiceNumbering({ mode: "Country Prefix", prefix: "LBN" })).toBeNull();
  });

  it("requires a positive integer next sequence", () => {
    expect(validateInvoiceNumbering({ mode: "Global", nextSequence: 0 })).toMatch(/positive integer/);
    expect(validateInvoiceNumbering({ mode: "Global", nextSequence: 1.5 })).toMatch(/positive integer/);
    expect(validateInvoiceNumbering({ mode: "Global", nextSequence: 42 })).toBeNull();
  });
});
