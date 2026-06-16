import { describe, expect, it } from "vitest";

import {
  deriveAdminNotifications,
  filterAdminNotifications,
  notificationSummary,
} from "@/lib/admin/notifications";
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@/lib/admin/notifications-ui";
import { notificationChannels, notificationEventTypes, validateNotificationRule } from "@/lib/business/notifications";

const input = {
  deleteQueue: [
    { id: "DEL-1", status: "Pending", entityType: "Invoice", entityId: "INV-9", requestedAt: "2026-06-10T10:00:00Z" },
    { id: "DEL-2", status: "Resolved", entityType: "Lead", entityId: "LEAD-9", requestedAt: "2026-06-09T10:00:00Z" },
  ],
  apiLogs: [
    { id: "L1", apiKey: "K", endpoint: "/api/x", statusCode: 200, createdAt: "2026-06-11T10:00:00Z" },
    { id: "L2", apiKey: "K", endpoint: "/api/y", statusCode: 500, createdAt: "2026-06-12T10:00:00Z" },
    { id: "L3", apiKey: "K", endpoint: "/api/z", statusCode: 403, createdAt: "2026-06-08T10:00:00Z" },
  ],
  integrationSettings: [
    { integrationType: "WhatsApp", connectionStatus: "Failed", lastTestedAt: "2026-06-13T10:00:00Z" },
    { integrationType: "SMTP", connectionStatus: "Connected", lastTestedAt: "2026-06-13T10:00:00Z" },
  ],
  commissionEntries: [
    { id: "C1", reseller: "A", status: "Pending", commissionAmount: 300, calculatedAt: "2026-06-07T10:00:00Z" },
    { id: "C2", reseller: "B", status: "Paid", commissionAmount: 100, calculatedAt: "2026-06-06T10:00:00Z" },
  ],
};

describe("deriveAdminNotifications (spec §40)", () => {
  const items = deriveAdminNotifications(input);
  it("only surfaces actionable signals", () => {
    // 1 pending delete + 2 api errors + 1 failed integration + 1 pending commission = 5
    expect(items).toHaveLength(5);
  });
  it("maps signals to the right category + severity", () => {
    expect(items.find((i) => i.id === "ntf-del-DEL-1")).toMatchObject({ category: "system", severity: "warning" });
    expect(items.find((i) => i.id === "ntf-api-L2")).toMatchObject({ category: "security", severity: "critical" });
    expect(items.find((i) => i.id === "ntf-api-L3")).toMatchObject({ category: "security", severity: "warning" });
    expect(items.find((i) => i.id === "ntf-int-WhatsApp")).toMatchObject({ category: "integration", severity: "critical" });
    expect(items.find((i) => i.id === "ntf-com-C1")).toMatchObject({ category: "business", severity: "info" });
  });
  it("sorts newest first", () => {
    expect(items[0].at >= items[items.length - 1].at).toBe(true);
  });
  it("each item links to a real admin surface", () => {
    for (const i of items) expect(i.href.startsWith("/admin/")).toBe(true);
  });
});

describe("filterAdminNotifications + summary", () => {
  const items = deriveAdminNotifications(input);
  it("filters by category", () => {
    expect(filterAdminNotifications(items, "security")).toHaveLength(2);
    expect(filterAdminNotifications(items, "all")).toHaveLength(5);
  });
  it("summarises totals + criticals", () => {
    const s = notificationSummary(items);
    expect(s.total).toBe(5);
    expect(s.critical).toBe(2); // L2 (500) + WhatsApp failed
    expect(s.byCategory.security).toBe(2);
  });
});

describe("notification rules parity (spec §29)", () => {
  it("UI literals match canonical event + channel lists", () => {
    expect([...NOTIFICATION_EVENTS].sort()).toEqual([...notificationEventTypes].sort());
    expect([...NOTIFICATION_CHANNELS].sort()).toEqual([...notificationChannels].sort());
  });
  it("validateNotificationRule accepts the new §29 events", () => {
    for (const eventType of ["Payment Overdue", "API Error", "Delete Request Submitted"]) {
      expect(validateNotificationRule({ eventType: eventType as never, channels: ["Email"], templateMessage: "x" })).toBeNull();
    }
  });
});
