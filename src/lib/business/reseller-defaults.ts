import { validateCountry } from "@/lib/phase2-data";
import type { CommissionTrigger } from "@/lib/phase2-data";
import type { Country } from "@/lib/sample-data";

/**
 * Structured reseller records (Phase 2 slice 6). A separate model + surface from
 * the legacy `resellers: string[]` list (which still feeds dropdowns elsewhere),
 * so this CRUD doesn't force a broad refactor. Pure validation, unit-testable.
 */

export const resellerVisibilityOptions = ["All Countries", "Assigned Countries"] as const;
export type ResellerVisibility = (typeof resellerVisibilityOptions)[number];

export const commissionTriggers: readonly CommissionTrigger[] = ["Invoice Created", "Deposit Paid", "Fully Paid"];

export interface Reseller {
  name: string;
  countries: Country[];
  defaultCurrency: string;
  defaultCommissionPercentage: number;
  defaultCommissionTrigger: CommissionTrigger;
  visibility: ResellerVisibility;
  isActive: boolean;
}

export const defaultResellers: Reseller[] = [
  {
    name: "Beirut Digital Partners",
    countries: ["Lebanon"],
    defaultCurrency: "USD",
    defaultCommissionPercentage: 12,
    defaultCommissionTrigger: "Fully Paid",
    visibility: "Assigned Countries",
    isActive: true,
  },
  {
    name: "MedTech Channel CY",
    countries: ["Cyprus"],
    defaultCurrency: "EUR",
    defaultCommissionPercentage: 10,
    defaultCommissionTrigger: "Invoice Created",
    visibility: "Assigned Countries",
    isActive: true,
  },
  {
    name: "Levant Growth Systems",
    countries: ["Jordan"],
    defaultCurrency: "JOD",
    defaultCommissionPercentage: 15,
    defaultCommissionTrigger: "Deposit Paid",
    visibility: "Assigned Countries",
    isActive: true,
  },
  {
    name: "Sham Partner Desk",
    countries: ["Syria"],
    defaultCurrency: "SYP",
    defaultCommissionPercentage: 8,
    defaultCommissionTrigger: "Fully Paid",
    visibility: "Assigned Countries",
    isActive: false,
  },
];

/**
 * Returns an error for an invalid reseller, or null when valid.
 * @param validCurrencyCodes currency codes considered acceptable (e.g. active currencies).
 */
export function validateReseller(
  reseller: Partial<Reseller>,
  validCurrencyCodes: readonly string[],
): string | null {
  if (!reseller.name || !reseller.name.trim()) {
    return "Reseller name is required.";
  }

  if (!Array.isArray(reseller.countries) || reseller.countries.length === 0) {
    return "Assign at least one country.";
  }
  for (const country of reseller.countries) {
    const countryError = validateCountry(country);
    if (countryError) {
      return `Assigned country "${country}": ${countryError}`;
    }
  }

  if (!reseller.defaultCurrency || !validCurrencyCodes.includes(reseller.defaultCurrency)) {
    return "Default currency must be an active platform currency.";
  }

  const pct = reseller.defaultCommissionPercentage;
  if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    return "Commission percentage must be between 0 and 100.";
  }

  if (!reseller.defaultCommissionTrigger || !commissionTriggers.includes(reseller.defaultCommissionTrigger)) {
    return `Commission trigger must be one of: ${commissionTriggers.join(", ")}.`;
  }

  if (!reseller.visibility || !(resellerVisibilityOptions as readonly string[]).includes(reseller.visibility)) {
    return "Visibility must be 'All Countries' or 'Assigned Countries'.";
  }

  return null;
}
