import { allowedCountries } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Follow-up reminder rules (Phase 2 slice 2) — HOOKS ONLY. Pure model +
 * validation + safe template rendering. No live calendar/OAuth: these rules
 * describe WHEN/HOW a follow-up reminder would fire; the engine computes the
 * trigger timestamps. Server remains the source of truth for authorization.
 */

export type ReminderChannel = "Email" | "WhatsApp" | "In-App";
export const reminderChannels: readonly ReminderChannel[] = ["Email", "WhatsApp", "In-App"];

export interface FollowUpReminderRule {
  id: string;
  label: string;
  /** Hours relative to the lead's follow-up time: negative = before, positive = after (overdue). */
  offsetHours: number;
  channels: ReminderChannel[];
  /** Audience scope. */
  country: string; // a country name or "All countries"
  isActive: boolean;
  /** Message body; may reference allowlisted tokens only (see ALLOWED_TOKENS). */
  template: string;
}

/** Only these tokens may appear as {{token}} in a template — injection guard. */
export const ALLOWED_TOKENS = ["lead.id", "lead.company", "lead.contact", "lead.followUp"] as const;
export type AllowedToken = (typeof ALLOWED_TOKENS)[number];

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;
const MAX_OFFSET_HOURS = 24 * 30; // ±30 days

export const defaultReminderRules: FollowUpReminderRule[] = [
  {
    id: "RMD-001",
    label: "2 hours before follow-up",
    offsetHours: -2,
    channels: ["In-App", "WhatsApp"],
    country: "All countries",
    isActive: true,
    template: "Reminder: follow up with {{lead.contact}} at {{lead.company}} ({{lead.followUp}}).",
  },
  {
    id: "RMD-002",
    label: "Overdue by 24 hours",
    offsetHours: 24,
    channels: ["Email"],
    country: "All countries",
    isActive: true,
    template: "Overdue: {{lead.company}} follow-up ({{lead.id}}) was due {{lead.followUp}}.",
  },
];

/** Returns a human-readable error for the first problem, or null when valid. */
export function validateFollowUpReminderRule(rule: Partial<FollowUpReminderRule>): string | null {
  if (!rule.label || !rule.label.trim()) {
    return "A rule label is required.";
  }
  if (typeof rule.offsetHours !== "number" || !Number.isFinite(rule.offsetHours) || !Number.isInteger(rule.offsetHours)) {
    return "Offset must be a whole number of hours.";
  }
  if (Math.abs(rule.offsetHours) > MAX_OFFSET_HOURS) {
    return `Offset must be within ±${MAX_OFFSET_HOURS} hours.`;
  }
  if (!Array.isArray(rule.channels) || rule.channels.length === 0) {
    return "Select at least one channel.";
  }
  if (rule.channels.some((c) => !(reminderChannels as readonly string[]).includes(c))) {
    return "Unsupported reminder channel.";
  }
  const country = rule.country ?? "";
  if (country !== "All countries" && !(allowedCountries as readonly string[]).includes(country)) {
    return "Country is not enabled for the platform.";
  }
  if (!rule.template || !rule.template.trim()) {
    return "A template message is required.";
  }
  const unknown = [...rule.template.matchAll(TOKEN_RE)]
    .map((m) => m[1])
    .filter((token) => !(ALLOWED_TOKENS as readonly string[]).includes(token));
  if (unknown.length) {
    return `Template uses unsupported token(s): ${[...new Set(unknown)].join(", ")}.`;
  }
  return null;
}

/** Whether a rule applies to a lead's country scope. */
export function ruleAppliesToCountry(rule: Pick<FollowUpReminderRule, "country">, country: string): boolean {
  return rule.country === "All countries" || rule.country === country;
}

/**
 * Render a template against a lead, substituting ONLY allowlisted tokens. Any
 * other {{...}} sequence is left untouched by design (validation rejects them
 * at write time; render stays defensive so no arbitrary data is interpolated).
 */
export function renderReminderTemplate(template: string, lead: PortalLead): string {
  const values: Record<AllowedToken, string> = {
    "lead.id": lead.id,
    "lead.company": lead.company,
    "lead.contact": lead.contact,
    "lead.followUp": lead.followUp,
  };
  return template.replace(TOKEN_RE, (whole, token: string) =>
    (ALLOWED_TOKENS as readonly string[]).includes(token) ? values[token as AllowedToken] : whole,
  );
}
