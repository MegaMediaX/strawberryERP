/**
 * Payment method validation — CLAUDE_HANDOFF.md §3 (payment methods are
 * configurable records). Fail-closed: unknown method name is rejected, and
 * assigned countries are subject to the country block (§9).
 */

import { validateCountry, type PaymentMethod } from "@/lib/phase2-data";

export const paymentMethodNames = [
  "Cash",
  "Bank Transfer",
  "OMT",
  "Whish",
  "Credit/Debit Card",
  "Crypto",
] as const;

export function validatePaymentMethod(method: Partial<PaymentMethod>): string | null {
  if (!method.methodName || !(paymentMethodNames as readonly string[]).includes(method.methodName)) {
    return `Payment method must be one of: ${paymentMethodNames.join(", ")}.`;
  }

  for (const country of method.countries ?? []) {
    const countryError = validateCountry(country);
    if (countryError) {
      return `Assigned country "${country}": ${countryError}`;
    }
  }

  if (
    method.displayOrder !== undefined &&
    (!Number.isInteger(method.displayOrder) || method.displayOrder < 0)
  ) {
    return "Display order must be a non-negative integer.";
  }

  return null;
}
