/**
 * Commission rule validation — CLAUDE_HANDOFF.md §3.
 * A rule ties a reseller + country + trigger to a commission percentage.
 * Fail-closed: country block applies (§9), percentage is bounded, and the
 * trigger / appliesTo values come from fixed allowlists.
 */

import { validateCountry, type CommissionRule } from "@/lib/phase2-data";

export const commissionTriggers = ["Invoice Created", "Deposit Paid", "Fully Paid"] as const;
export const commissionAppliesTo = ["Invoice Total", "Receipt Amount"] as const;

export function validateCommissionRule(rule: Partial<CommissionRule>): string | null {
  if (!rule.reseller || !rule.reseller.trim()) {
    return "A reseller is required for a commission rule.";
  }

  const countryError = validateCountry(rule.country);
  if (countryError) {
    return countryError;
  }

  const pct = rule.commissionPercentage;
  if (pct === undefined || typeof pct !== "number" || Number.isNaN(pct) || pct <= 0 || pct > 100) {
    return "Commission percentage must be a number greater than 0 and at most 100.";
  }

  if (!rule.triggerCondition || !(commissionTriggers as readonly string[]).includes(rule.triggerCondition)) {
    return `Trigger condition must be one of: ${commissionTriggers.join(", ")}.`;
  }

  if (rule.appliesTo && !(commissionAppliesTo as readonly string[]).includes(rule.appliesTo)) {
    return `Applies-to must be one of: ${commissionAppliesTo.join(", ")}.`;
  }

  return null;
}
