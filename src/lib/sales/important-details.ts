/**
 * Important Details (spec §8) — the sales instructions shown on the lead call
 * screen, written by Reseller Admin / Super Admin. Read-only here, sourced from
 * a per-reseller seed with a global fallback; full admin editing is a later
 * slice. Pure + unit-testable.
 */

const GLOBAL_DETAILS: string[] = [
  "Resellers are partners, not sponsors — set that expectation early.",
  "Do not promise discounts without admin approval.",
  "Confirm whether an invoice should be issued before the contract.",
];

const PER_RESELLER: Record<string, string[]> = {
  "Beirut Digital Partners": [
    "Mention the early-bird registration package.",
    "USD invoicing is the default for this reseller.",
    "Resellers are partners, not sponsors — set that expectation early.",
    "Do not promise discounts without admin approval.",
  ],
  "MedTech Channel CY": [
    "EUR invoicing for Cyprus accounts.",
    "Lead with the white-label invoice + card-payment story.",
    "Do not promise discounts without admin approval.",
  ],
};

/** The instruction lines for a lead's reseller, falling back to the global set. */
export function importantDetailsFor(reseller: string): string[] {
  return PER_RESELLER[reseller] ?? GLOBAL_DETAILS;
}
