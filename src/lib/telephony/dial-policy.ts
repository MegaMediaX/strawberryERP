import { normalizePhone } from "@/lib/telephony/call-record";

/**
 * Auto-dialer reach policy (ADR 0001, Phase 3). The on-prem trunk can only place
 * certain kinds of calls, and that capability differs per country — so the policy
 * is a per-country table, not a hardcoded rule. Each country picks a mode:
 *
 *   - "auto"      → the dialer may call any number in this country (mobile OR landline)
 *   - "mobile"    → mobile numbers only
 *   - "landline"  → landline numbers only
 *
 * A number is classified (mobile / landline) from the country's numbering prefixes
 * and checked against that country's mode. Anything outside the table is not
 * dialable. Purely data + pure functions here; the dial route enforces it and the
 * UI surfaces the returned reason verbatim.
 *
 * To change what the dialer can reach, edit DIAL_POLICY below — no other code
 * changes are needed.
 */

export type LineType = "mobile" | "landline" | "unknown";
export type DialMode = "auto" | "mobile" | "landline";

export interface CountryDialRule {
  /** Display name used in operator-facing messages. */
  country: string;
  /** E.164 country calling code, digits only (e.g. "961" for Lebanon). */
  callingCode: string;
  /** What the trunk may dial in this country. */
  mode: DialMode;
  /** National-significant-number prefixes that identify a mobile line. */
  mobilePrefixes: string[];
  /** National-significant-number prefixes that identify a landline. */
  landlinePrefixes: string[];
}

/**
 * Country a bare national number (no +country-code) is assumed to belong to.
 * The platform is Lebanon-centric, so national-format numbers default to LB.
 */
export const DEFAULT_CALLING_CODE = "961";

/**
 * The dialer reach table. Add a country row to enable it; set `mode` to control
 * which line types are callable there. Countries not listed are not dialable.
 */
export const DIAL_POLICY: CountryDialRule[] = [
  {
    country: "Lebanon",
    callingCode: "961",
    // Current trunk (analog FXO on ext 1001) is provisioned for landline calls only.
    mode: "landline",
    // Lebanese mobile prefixes (Alfa / touch): 3, 70, 71, 76, 78, 79, 81.
    mobilePrefixes: ["3", "70", "71", "76", "78", "79", "81"],
    // Lebanese fixed-line area codes: 1 (Beirut), 4–9 (regions).
    landlinePrefixes: ["1", "4", "5", "6", "7", "8", "9"],
  },
];

function ruleForCallingCode(code: string): CountryDialRule | undefined {
  // Longest calling code wins (defends against future overlapping codes like 1 vs 1xx).
  return [...DIAL_POLICY]
    .sort((a, b) => b.callingCode.length - a.callingCode.length)
    .find((r) => code.startsWith(r.callingCode));
}

/** Drop a national trunk-access "0" if present. */
function stripTrunk(nsn: string): string {
  return nsn.startsWith("0") ? nsn.slice(1) : nsn;
}

interface Resolved {
  rule?: CountryDialRule;
  /** National significant number (no country code, no trunk 0), or "" if unknown. */
  nsn: string;
  /** True when the number carried an explicit +country-code we couldn't match. */
  unknownInternational: boolean;
}

/** Resolve a raw number to its country rule + national significant number. */
function resolve(raw: string): Resolved {
  const n = normalizePhone(raw);
  const digits = n.startsWith("+") ? n.slice(1) : n;

  if (n.startsWith("+")) {
    const rule = ruleForCallingCode(digits);
    if (!rule) return { nsn: "", unknownInternational: true };
    return { rule, nsn: stripTrunk(digits.slice(rule.callingCode.length)), unknownInternational: false };
  }

  // No "+": a leading country code, or a national number.
  const byCode = ruleForCallingCode(digits);
  if (byCode && digits.startsWith(byCode.callingCode) && digits.length > byCode.callingCode.length) {
    return { rule: byCode, nsn: stripTrunk(digits.slice(byCode.callingCode.length)), unknownInternational: false };
  }
  const fallback = DIAL_POLICY.find((r) => r.callingCode === DEFAULT_CALLING_CODE);
  return { rule: fallback, nsn: stripTrunk(digits), unknownInternational: false };
}

/** Classify a number as mobile / landline for its country (longest prefix wins). */
export function classifyLine(raw: string): LineType {
  const { rule, nsn } = resolve(raw);
  if (!rule || !nsn) return "unknown";
  const tagged = [
    ...rule.mobilePrefixes.map((p) => ({ p, type: "mobile" as const })),
    ...rule.landlinePrefixes.map((p) => ({ p, type: "landline" as const })),
  ].sort((a, b) => b.p.length - a.p.length);
  return tagged.find((t) => nsn.startsWith(t.p))?.type ?? "unknown";
}

export interface DialPolicyDecision {
  ok: boolean;
  country?: string;
  lineType: LineType;
  /** Operator-facing reason when ok === false. Safe to show verbatim. */
  reason?: string;
}

const MODE_LABEL: Record<DialMode, string> = {
  auto: "any",
  mobile: "mobile",
  landline: "landline",
};

/**
 * Decide whether the auto-dialer may place this call, with a clear reason when not.
 * (Country-blocking, e.g. IL/ISR, is handled separately by isBlockedPhone.)
 */
export function checkDialPolicy(raw: string): DialPolicyDecision {
  const { rule, nsn, unknownInternational } = resolve(raw);

  if (unknownInternational) {
    return {
      ok: false,
      lineType: "unknown",
      reason: "The auto-dialer can only call countries it is configured for; this international number is not one of them.",
    };
  }
  if (!rule) {
    return {
      ok: false,
      lineType: "unknown",
      reason: "The auto-dialer is not enabled for this destination.",
    };
  }
  if (!nsn) {
    return {
      ok: false,
      country: rule.country,
      lineType: "unknown",
      reason: `This does not look like a valid ${rule.country} number.`,
    };
  }

  const lineType = classifyLine(raw);

  if (rule.mode === "auto") {
    return { ok: true, country: rule.country, lineType };
  }
  if (lineType === "unknown") {
    return {
      ok: false,
      country: rule.country,
      lineType,
      reason: `Could not tell whether this is a ${rule.country} mobile or landline; the auto-dialer only places ${MODE_LABEL[rule.mode]} calls in ${rule.country}.`,
    };
  }
  if (lineType !== rule.mode) {
    return {
      ok: false,
      country: rule.country,
      lineType,
      reason: `This is a ${rule.country} ${lineType} number, but the auto-dialer is set to call ${rule.country} ${MODE_LABEL[rule.mode]} numbers only.`,
    };
  }
  return { ok: true, country: rule.country, lineType };
}
