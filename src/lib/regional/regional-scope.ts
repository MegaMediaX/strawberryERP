/**
 * Regional Director country scope (spec §2/§6). Pure + unit-testable. The
 * country selector drives the whole interface: a director sees ALL assigned
 * countries by default, or a single one when selected. A selection outside the
 * assigned set is ignored (never widens scope) — defense in depth on top of the
 * role scoping already applied by getUiLeads/getUiRows.
 */
export const COUNTRY_ALL = "all";

/** The effective country list to filter by, given the assigned set + selection. */
export function resolveRegionalCountries(
  assigned: readonly string[],
  selected?: string,
): string[] {
  if (selected && selected !== COUNTRY_ALL && assigned.includes(selected)) {
    return [selected];
  }
  return [...assigned];
}

/** True when a record's country is within the effective scope. */
export function inCountryScope(country: string, effectiveCountries: readonly string[]): boolean {
  return effectiveCountries.includes(country);
}

/** Filter any country-bearing rows down to the effective scope. */
export function scopeByCountry<T extends { country: string }>(
  rows: readonly T[],
  effectiveCountries: readonly string[],
): T[] {
  return rows.filter((r) => effectiveCountries.includes(r.country));
}
