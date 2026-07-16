import { afterEach, describe, expect, it } from "vitest";

import { getPlatformSettings, getPlatformTimeZone, getSlotConfig, setPlatformSettingsSection } from "@/lib/dev-store";
import { defaultPlatformSettings } from "@/lib/admin/platform-settings";

/**
 * Spec: "single global calendar from `platformSettings.general.defaultTimezone`,
 * admin-editable". The slot calendar must therefore SOURCE its zone from platform
 * settings, not carry its own hardcoded copy — and because platform settings are
 * editable at runtime, sourcing it once at seed time is not enough.
 *
 * This matters beyond tidiness: the working-hours math is timezone-sensitive, so a
 * stale zone means every hold expires at the wrong moment.
 */
const original = getPlatformSettings().general;

function setTimezone(defaultTimezone: string) {
  setPlatformSettingsSection("general", { ...original, defaultTimezone });
}

describe("slot calendar timezone follows platform settings", () => {
  afterEach(() => setPlatformSettingsSection("general", original));

  it("defaults to the platform-settings zone, not a hardcoded literal", () => {
    expect(getSlotConfig().calendar.timezone).toBe(original.defaultTimezone);
    expect(original.defaultTimezone).toBe("Asia/Beirut"); // guards the seed value itself
  });

  // The regression: an admin edits the zone AFTER the store is seeded. A value
  // captured at seed time would still read "Asia/Beirut" here.
  it("picks up an admin's change at runtime", () => {
    setTimezone("Europe/Paris");
    expect(getSlotConfig().calendar.timezone).toBe("Europe/Paris");

    setTimezone("America/New_York");
    expect(getSlotConfig().calendar.timezone).toBe("America/New_York");
  });

  it("leaves the rest of the calendar alone", () => {
    setTimezone("Europe/Paris");
    const cal = getSlotConfig().calendar;
    expect(cal.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect([cal.startHour, cal.endHour]).toEqual([9, 17]);
  });

  it("falls back to the documented default when the setting is blank", () => {
    setTimezone("");
    // Falling back to UTC here would silently shift every expiry by the offset.
    // The same fallback backs getPlatformTimeZone(), so the slot calendar and the
    // admin tables can never disagree about what zone "blank" means.
    expect(getSlotConfig().calendar.timezone).toBe(defaultPlatformSettings.general.defaultTimezone);
    expect(getPlatformTimeZone()).toBe(getSlotConfig().calendar.timezone);
  });

  it("does not disturb the other slot config fields", () => {
    setTimezone("Europe/Paris");
    const config = getSlotConfig();
    expect(config.currency).toBe("USD");
    expect(config.priceBySlot.A1).toBe(1500);
    expect(config.activeSlots).toContain("A1");
  });
});
