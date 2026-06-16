/**
 * Client-safe constants for the Notification Rules manager + Super Admin
 * notification inbox (spec §29 / §40). FREE of any `phase2-data` value import
 * so it can be bundled client-side without pulling `node:fs`. A test asserts
 * parity with the canonical `notificationEventTypes` / `notificationChannels`.
 */

export const NOTIFICATION_EVENTS = [
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

export const NOTIFICATION_CHANNELS = ["Email", "WhatsApp", "Calendar", "In-App"] as const;
export type NotificationChannelName = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_ROLES = ["Any role", "Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"] as const;

/** §40 inbox categories for the severity filter. */
export const NOTIFICATION_CATEGORIES = ["system", "business", "security", "integration"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationSeverity = "info" | "warning" | "critical";

export const SEVERITY_TONE: Record<NotificationSeverity, "blue" | "amber" | "rose"> = {
  info: "blue",
  warning: "amber",
  critical: "rose",
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  system: "System",
  business: "Business",
  security: "Security",
  integration: "Integration",
};
