import {
  renderReminderTemplate,
  ruleAppliesToCountry,
  type FollowUpReminderRule,
} from "@/lib/business/followup-reminder-rules";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Pure reminder-scheduling engine (Phase 2 slice 2). Given a lead with a
 * follow-up time and a set of rules, compute the reminder events that would
 * fire — each at `followUp + offsetHours`. All timestamps are ISO-8601 UTC, so
 * the result is timezone-drift-free and deterministic for tests.
 */

export interface ReminderEvent {
  ruleId: string;
  label: string;
  leadId: string;
  channels: string[];
  /** ISO-8601 UTC instant the reminder should fire. */
  triggersAt: string;
  message: string;
}

const HOUR_MS = 60 * 60 * 1000;

function parseFollowUp(value: string): number | null {
  if (!value || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Reminder events for a lead under the active, country-matching rules. A lead
 * with no parseable follow-up date yields no events (nothing to schedule).
 * Results are sorted by trigger time.
 */
export function calculateReminderEvents(lead: PortalLead, rules: readonly FollowUpReminderRule[]): ReminderEvent[] {
  const baseMs = parseFollowUp(lead.followUp);
  if (baseMs === null) return [];

  return rules
    .filter((rule) => rule.isActive && ruleAppliesToCountry(rule, lead.country))
    .map((rule) => ({
      ruleId: rule.id,
      label: rule.label,
      leadId: lead.id,
      channels: [...rule.channels],
      triggersAt: new Date(baseMs + rule.offsetHours * HOUR_MS).toISOString(),
      message: renderReminderTemplate(rule.template, lead),
    }))
    .sort((a, b) => a.triggersAt.localeCompare(b.triggersAt));
}
