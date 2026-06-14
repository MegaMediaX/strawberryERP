import { describe, expect, it } from "vitest";

import {
  defaultChannelPreferences,
  mergePreferencesWithDefaults,
  validateUserNotificationPreferences,
} from "@/lib/business/notification-preferences";

describe("mergePreferencesWithDefaults", () => {
  it("returns the defaults when nothing is provided", () => {
    expect(mergePreferencesWithDefaults()).toEqual(defaultChannelPreferences);
  });

  it("overrides only the provided channels and ignores unknown keys", () => {
    const merged = mergePreferencesWithDefaults({ WhatsApp: true, Email: false, Bogus: true } as never);
    expect(merged.WhatsApp).toBe(true);
    expect(merged.Email).toBe(false);
    expect(merged["In-App"]).toBe(true); // untouched default
    expect((merged as Record<string, boolean>).Bogus).toBeUndefined();
  });
});

describe("validateUserNotificationPreferences", () => {
  const valid = { userId: "USR-SUPER", channels: { Email: true, WhatsApp: false, Calendar: true, "In-App": true } };

  it("accepts a valid preference", () => {
    expect(validateUserNotificationPreferences(valid)).toBeNull();
  });

  it("requires a userId", () => {
    expect(validateUserNotificationPreferences({ ...valid, userId: "  " })).toMatch(/user id/i);
  });

  it("requires a channels object", () => {
    expect(validateUserNotificationPreferences({ userId: "USR-1" })).toMatch(/channel preferences/i);
  });

  it("rejects an unsupported channel", () => {
    expect(validateUserNotificationPreferences({ userId: "USR-1", channels: { SMS: true } as never })).toMatch(/unsupported channel/i);
  });

  it("rejects a non-boolean channel value", () => {
    expect(validateUserNotificationPreferences({ userId: "USR-1", channels: { Email: "yes" } as never })).toMatch(/on or off/i);
  });
});
