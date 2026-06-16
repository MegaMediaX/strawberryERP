import type { NotificationCategory, NotificationSeverity } from "@/lib/admin/notifications-ui";
import { NOTIFICATION_CATEGORIES } from "@/lib/admin/notifications-ui";

/**
 * Super Admin notification INBOX derivation (spec §40). Pure + unit-testable.
 * Builds a severity-grouped, filterable feed from live platform signals
 * (delete queue, API errors, failed integrations, pending commissions). Each
 * item links to the exact surface that needs attention. The §29 rule
 * validation is reused from `@/lib/business/notifications`.
 */

export interface AdminNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  href: string;
  at: string;
}

interface DerivationInput {
  deleteQueue: readonly { id: string; status: string; entityType: string; entityId: string; requestedAt: string }[];
  apiLogs: readonly { id: string; apiKey: string; endpoint: string; statusCode: number; createdAt: string }[];
  integrationSettings: readonly { integrationType: string; connectionStatus: string; lastTestedAt: string }[];
  commissionEntries: readonly { id: string; reseller: string; status: string; commissionAmount: number; calculatedAt: string }[];
}

export function deriveAdminNotifications(input: DerivationInput): AdminNotification[] {
  const items: AdminNotification[] = [];

  for (const d of input.deleteQueue) {
    if (d.status !== "Pending") continue;
    items.push({ id: `ntf-del-${d.id}`, category: "system", severity: "warning", title: "Delete request waiting", detail: `${d.entityType} ${d.entityId} needs review`, href: "/admin/delete-queue", at: d.requestedAt });
  }

  for (const l of input.apiLogs) {
    if (l.statusCode < 400) continue;
    items.push({ id: `ntf-api-${l.id}`, category: "security", severity: l.statusCode >= 500 ? "critical" : "warning", title: `API error ${l.statusCode}`, detail: `${l.apiKey} → ${l.endpoint}`, href: "/admin/api/logs", at: l.createdAt });
  }

  for (const s of input.integrationSettings) {
    if (s.connectionStatus !== "Failed") continue;
    items.push({ id: `ntf-int-${s.integrationType}`, category: "integration", severity: "critical", title: `${s.integrationType} disconnected`, detail: "Last connection test failed", href: "/admin/integrations", at: s.lastTestedAt || "" });
  }

  for (const c of input.commissionEntries) {
    if (c.status !== "Pending") continue;
    items.push({ id: `ntf-com-${c.id}`, category: "business", severity: "info", title: "Commission pending approval", detail: `${c.reseller} · ${c.commissionAmount.toLocaleString()}`, href: "/admin/commissions", at: c.calculatedAt });
  }

  // newest first by timestamp (empty timestamps sort last)
  return items.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

export function filterAdminNotifications(items: readonly AdminNotification[], category: NotificationCategory | "all"): AdminNotification[] {
  if (category === "all") return [...items];
  return items.filter((n) => n.category === category);
}

export function notificationSummary(items: readonly AdminNotification[]) {
  const byCategory: Record<string, number> = {};
  for (const c of NOTIFICATION_CATEGORIES) byCategory[c] = 0;
  let critical = 0;
  for (const n of items) {
    byCategory[n.category] = (byCategory[n.category] ?? 0) + 1;
    if (n.severity === "critical") critical += 1;
  }
  return { total: items.length, critical, byCategory };
}
