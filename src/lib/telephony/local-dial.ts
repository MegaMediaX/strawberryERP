import { normalizePhone } from "@/lib/telephony/call-record";

/**
 * Convert a stored lead/customer number to the LOCAL trunk-0 format the analog
 * FXO gateway dials (ADR 0001, Option B). The trunk cannot place E.164 calls:
 * "+961 5 941 119" must go out as "05941119". Lebanon dials the national trunk
 * "0" for mobiles AND landlines alike (03 / 070 / 01 / 05 — see dial-policy.ts),
 * so +961 / 961 / 00961 prefixes are replaced with a single leading 0. Numbers
 * already in local form pass through; foreign international numbers are left as
 * raw digits for the gateway/dialplan to police (isBlockedPhone runs upstream
 * on the raw value). Mirrors the defensive rewrite in the Asterisk dialplan.
 */

/** Lebanese NSNs (area/mobile prefix + subscriber) are 7–8 digits. */
const MIN_NSN_DIGITS = 7;

export function toLocalDialNumber(raw: string): string {
  const normalized = normalizePhone(raw);
  const hasPlus = normalized.startsWith("+");
  const digits = hasPlus ? normalized.slice(1) : normalized;
  if (!digits) return "";

  if (digits.startsWith("961")) {
    const rest = digits.slice(3);
    const nsn = rest.startsWith("0") ? rest.slice(1) : rest;
    // A bare local NSN can also start with "961" (area 9 landline, e.g.
    // 9614941) — only treat "961" as a country code when what follows is a
    // plausible NSN, or the number was explicitly international (+/00961).
    // A country code with no subscriber digits (e.g. a "+961" placeholder lead)
    // is not dialable — return "" so the caller shows "no dialable number".
    if (hasPlus || nsn.length >= MIN_NSN_DIGITS) return nsn ? `0${nsn}` : "";
  }

  // Non-Lebanese international number: pass raw digits through unchanged.
  if (hasPlus) return digits;

  return digits.startsWith("0") ? digits : `0${digits}`;
}
