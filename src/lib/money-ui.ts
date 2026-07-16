/**
 * Client-safe currency rendering. No runtime imports from phase2-data or
 * dev-store, so `"use client"` components can import it freely.
 *
 * WHY THIS EXISTS: these views formatted money with `toLocaleString()` — or
 * `toLocaleString(undefined, …)`, which is the same thing — and that resolves the
 * locale from the RUNTIME. The server renders with Node's default locale and the
 * browser with the viewer's, so a French viewer is served "1,234.56" from the
 * server and hydrates "1 234,56" on the client: a React hydration mismatch, and
 * inconsistent output regardless. The locale must be explicit.
 *
 * Amounts are capped at 2 fraction digits. Bare `toLocaleString()` defaults to a
 * maximum of 3, so any amount carrying a third decimal rendered as money with
 * three decimal places.
 *
 * House style is the currency CODE, a space, then the amount ("USD 1,234.56") —
 * not Intl's `style: "currency"` symbol form ("$1,234.56") — matching how the rest
 * of the app prints money.
 */

const AMOUNT_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** `1,234.56` — the bare amount, locale pinned. */
export function formatAmount(value: number): string {
  return AMOUNT_FORMATTER.format(value);
}

/**
 * `USD 1,234.56`. A nullish amount renders as zero, preserving the existing
 * behaviour of the console this replaced. NaN is deliberately NOT coerced: it
 * surfaces as "NaN" rather than a plausible-looking 0, because a NaN reaching a
 * money field is a data bug worth seeing, not hiding.
 */
export function formatMoney(value: number | undefined, currency = "USD"): string {
  return `${currency} ${formatAmount(value ?? 0)}`;
}
