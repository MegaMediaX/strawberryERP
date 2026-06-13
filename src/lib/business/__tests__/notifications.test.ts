import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/[...resource]/route";
import {
  notificationChannels,
  notificationEventTypes,
  validateNotificationRule,
} from "@/lib/business/notifications";

/**
 * Notification rules validation + create-route authorization (§9 / §18).
 */

const validRule = {
  eventType: "Invoice Issued" as const,
  channels: ["Email", "WhatsApp"] as never,
  country: "All countries" as const,
  reseller: "All resellers" as const,
  role: "Any role" as const,
  isActive: true,
  templateMessage: "Your invoice {{number}} is ready.",
};

describe("validateNotificationRule", () => {
  it("accepts a well-formed rule", () => {
    expect(validateNotificationRule(validRule)).toBeNull();
  });

  it("accepts every event type and channel", () => {
    for (const eventType of notificationEventTypes) {
      expect(validateNotificationRule({ ...validRule, eventType })).toBeNull();
    }
    for (const channel of notificationChannels) {
      expect(validateNotificationRule({ ...validRule, channels: [channel] as never })).toBeNull();
    }
  });

  it("requires at least one channel", () => {
    expect(validateNotificationRule({ ...validRule, channels: [] as never })).toMatch(/at least one/i);
  });

  it("rejects an unknown event type and unknown channel", () => {
    expect(validateNotificationRule({ ...validRule, eventType: "Spaceship Landed" as never })).toMatch(/Event type/);
    expect(validateNotificationRule({ ...validRule, channels: ["Carrier Pigeon"] as never })).toMatch(/channel/);
  });

  it("applies the country block to a non-wildcard country", () => {
    expect(validateNotificationRule({ ...validRule, country: "Israel" as never })).toMatch(/not enabled/);
    expect(validateNotificationRule({ ...validRule, country: "Lebanon" as never })).toBeNull();
  });

  it("requires a template message", () => {
    expect(validateNotificationRule({ ...validRule, templateMessage: "  " })).toMatch(/template message/i);
  });
});

function post(body: Record<string, unknown>, opts: { userId?: string; impersonate?: string } = {}) {
  const resource = ["settings", "notifications"];
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-platform-user-id": opts.userId ?? "USR-SUPER",
  };
  if (opts.impersonate) headers["x-platform-impersonate-user-id"] = opts.impersonate;
  return POST(
    new Request("https://portal.local/api/frappe/settings/notifications", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource }) },
  );
}

describe("POST settings/notifications", () => {
  it("creates a rule for a Super Admin", async () => {
    expect((await post(validRule)).status).toBe(201);
  });

  it("rejects an invalid rule (400)", async () => {
    expect((await post({ ...validRule, channels: [] })).status).toBe(400);
  });

  it("denies a non-Super-Admin (403)", async () => {
    expect((await post(validRule, { userId: "USR-SALES-RAMI" })).status).toBe(403);
  });

  it("blocks an impersonating Super Admin (403)", async () => {
    expect((await post(validRule, { userId: "USR-SUPER", impersonate: "USR-SALES-RAMI" })).status).toBe(403);
  });
});
