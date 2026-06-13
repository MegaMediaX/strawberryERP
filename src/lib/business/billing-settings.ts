/**
 * Billing settings validation — CLAUDE_HANDOFF.md §3:
 * currencies are configurable records; invoice numbering supports a global or
 * country-oriented mode. Currency country assignments are still subject to the
 * country block (§9 — no Israel/IL/ISR).
 */

import { validateCountry, type CurrencySetting } from "@/lib/phase2-data";

export const invoiceNumberingModes = ["Global", "Country Prefix"] as const;
export type InvoiceNumberingMode = (typeof invoiceNumberingModes)[number];

const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

export function validateCurrencySetting(setting: Partial<CurrencySetting>): string | null {
  if (!setting.currencyCode || !CURRENCY_CODE_RE.test(setting.currencyCode)) {
    return "Currency code must be a 3-letter ISO code (e.g. USD).";
  }

  if (!setting.currencyName || !setting.currencyName.trim()) {
    return "Currency name is required.";
  }

  if (!setting.symbol || !setting.symbol.trim()) {
    return "Currency symbol is required.";
  }

  const precision = setting.decimalPrecision;
  if (precision === undefined || !Number.isInteger(precision) || precision < 0 || precision > 4) {
    return "Decimal precision must be an integer between 0 and 4.";
  }

  if (setting.manualExchangeRate !== undefined && !(setting.manualExchangeRate > 0)) {
    return "Manual exchange rate must be greater than zero.";
  }

  for (const country of setting.assignedCountries ?? []) {
    const countryError = validateCountry(country);
    if (countryError) {
      return `Assigned country "${country}": ${countryError}`;
    }
  }

  return null;
}

export interface InvoiceNumberingConfig {
  mode: string;
  prefix?: string;
  nextSequence?: number;
}

export function validateInvoiceNumbering(config: Partial<InvoiceNumberingConfig>): string | null {
  if (!config.mode || !(invoiceNumberingModes as readonly string[]).includes(config.mode)) {
    return `Numbering mode must be one of: ${invoiceNumberingModes.join(", ")}.`;
  }

  if (config.mode === "Country Prefix" && config.prefix !== undefined && !/^[A-Za-z]{2,4}$/.test(config.prefix)) {
    return "Numbering prefix must be 2-4 letters.";
  }

  if (
    config.nextSequence !== undefined &&
    (!Number.isInteger(config.nextSequence) || config.nextSequence < 1)
  ) {
    return "Next sequence must be a positive integer.";
  }

  return null;
}
