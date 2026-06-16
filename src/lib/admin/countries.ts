/**
 * Super Admin country management (spec §9 + §42). Pure + unit-testable. Countries
 * are business regions with a currency, timezone, invoice prefix, and active
 * flag. Israel (and its IL/ISR/occupied-palestine variants) is hard-BLOCKED
 * (§42) — the platform operates only in approved regions. Persistence lives in
 * the dev-store `countries` collection; these helpers validate + preview.
 */

export interface CountryRecord {
  name: string;
  currency: string;
  timezone: string;
  invoicePrefix: string;
  active: boolean;
  paymentMethods: string[];
}

/** §42 blocked-country patterns (case/space-insensitive). */
const BLOCKED = ["israel", "il", "isr", "occupiedpalestine", "occupied palestine", "palestine-occupied"];

export function isBlockedCountryName(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  const compact = n.replace(/\s+/g, "");
  return BLOCKED.some((b) => n === b || compact === b.replace(/\s+/g, ""));
}

export interface CountryFormInput {
  name: string;
  currency: string;
  timezone: string;
  invoicePrefix: string;
}

export interface CountryFormContext {
  existingNames: string[];
  existingPrefixes: string[];
  isEdit: boolean;
}

const PREFIX_RE = /^[A-Z0-9-]{2,12}$/;

/** Returns an error string if the country form is invalid, otherwise null. */
export function validateCountryForm(input: Partial<CountryFormInput>, ctx: CountryFormContext): string | null {
  const name = (input.name ?? "").trim();
  if (!name) return "Country name is required.";
  if (isBlockedCountryName(name)) {
    return "This country cannot be added to the platform. Please choose another country.";
  }
  if (!ctx.isEdit && ctx.existingNames.map((n) => n.toLowerCase()).includes(name.toLowerCase())) {
    return "A country with this name already exists.";
  }
  if (!input.currency) return "Select a currency.";
  if (!input.timezone) return "Select a timezone.";
  const prefix = (input.invoicePrefix ?? "").trim().toUpperCase();
  if (!prefix) return "An invoice prefix is required.";
  if (!PREFIX_RE.test(prefix)) return "Invoice prefix must be 2–12 chars: A–Z, 0–9, hyphen.";
  const dupePrefix = ctx.existingPrefixes.map((p) => p.toUpperCase()).includes(prefix);
  if (!ctx.isEdit && dupePrefix) return "Another country already uses this invoice prefix.";
  return null;
}

/** §9 invoice preview — show what the next invoice number looks like for a prefix. */
export function previewInvoiceNumber(prefix: string, seq = 1): string {
  const p = prefix.trim().toUpperCase() || "INV";
  return `${p}-${String(seq).padStart(4, "0")}`;
}

/** The four seeded default regions (§9). */
export function defaultCountries(): CountryRecord[] {
  return [
    { name: "Lebanon", currency: "USD", timezone: "Asia/Beirut", invoicePrefix: "LB-INV", active: true, paymentMethods: ["Cash", "Bank Transfer", "OMT", "Whish"] },
    { name: "Cyprus", currency: "EUR", timezone: "Asia/Nicosia", invoicePrefix: "CY-INV", active: true, paymentMethods: ["Cash", "Bank Transfer", "Credit/Debit Card"] },
    { name: "Jordan", currency: "JOD", timezone: "Asia/Amman", invoicePrefix: "JO-INV", active: true, paymentMethods: ["Cash", "Bank Transfer"] },
    { name: "Syria", currency: "SYP", timezone: "Asia/Damascus", invoicePrefix: "SY-INV", active: true, paymentMethods: ["Cash"] },
  ];
}

/** Timezone choices offered in the form (§9). */
export const TIMEZONE_OPTIONS = ["Asia/Beirut", "Asia/Nicosia", "Asia/Amman", "Asia/Damascus", "UTC"] as const;
