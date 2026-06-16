/**
 * Notification rules validation — CLAUDE_HANDOFF.md (Super-Admin-configurable
 * notification rules across Email / WhatsApp / Calendar / In-App).
 *
 * Fail-closed: unknown event/channel/role is rejected; the country scope is
 * still subject to the country block (§9) unless it is the "All countries"
 * wildcard.
 */

import { validateCountry, type NotificationRule } from "@/lib/phase2-data";

export const notificationEventTypes = [
  "Lead Follow-Up Due",
  "Invoice Issued",
  "Receipt Issued",
  "Contract Signed",
  "Customer Converted",
  "Commission Created",
  "Contract Pending",
  "Payment Overdue",
  "Lead Assigned",
  "Lead Transferred",
  "API Error",
  "WhatsApp Failure",
  "Delete Request Submitted",
] as const;

export const notificationChannels = ["Email", "WhatsApp", "Calendar", "In-App"] as const;

const roles = ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User", "Any role"];

export function validateNotificationRule(rule: Partial<NotificationRule>): string | null {
  if (!rule.eventType || !(notificationEventTypes as readonly string[]).includes(rule.eventType)) {
    return `Event type must be one of: ${notificationEventTypes.join(", ")}.`;
  }

  if (!rule.channels || rule.channels.length === 0) {
    return "At least one notification channel is required.";
  }

  for (const channel of rule.channels) {
    if (!(notificationChannels as readonly string[]).includes(channel)) {
      return `Unknown notification channel: ${channel}.`;
    }
  }

  if (rule.country && rule.country !== "All countries") {
    const countryError = validateCountry(rule.country);
    if (countryError) {
      return `Country "${rule.country}": ${countryError}`;
    }
  }

  if (rule.role && !roles.includes(rule.role)) {
    return `Unknown role: ${rule.role}.`;
  }

  if (!rule.templateMessage || !rule.templateMessage.trim()) {
    return "A template message is required.";
  }

  return null;
}
