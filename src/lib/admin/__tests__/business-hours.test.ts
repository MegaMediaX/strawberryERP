import { describe, expect, it } from "vitest";

import {
  defaultBusinessCalendar,
  holdExpiresAt,
  isHoldExpired,
  workingHoursElapsed,
  type BusinessCalendar,
} from "@/lib/admin/business-hours";

// 2026-06-15 is a Monday. Calendar: Mon–Fri (1–5), 09:00–17:00 UTC = 8 working hrs/day.
// These UTC-zone cases are the control group: in "UTC" the instant IS the wall-clock,
// so they must stay byte-identical across the timezone fix.
const cal: BusinessCalendar = { timezone: "UTC", workingDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, holidays: [] };
const iso = (s: string) => `${s}:00.000Z`;

describe("workingHoursElapsed", () => {
  it("same working day", () => {
    expect(workingHoursElapsed(iso("2026-06-15T09:00"), iso("2026-06-15T12:00"), cal)).toBeCloseTo(3);
  });
  it("returns 0 when now <= start", () => {
    expect(workingHoursElapsed(iso("2026-06-15T12:00"), iso("2026-06-15T09:00"), cal)).toBe(0);
  });
  it("skips the overnight gap", () => {
    // Mon 15:00→17:00 (2h) + Tue 09:00→11:00 (2h) = 4h; the night does not count
    expect(workingHoursElapsed(iso("2026-06-15T15:00"), iso("2026-06-16T11:00"), cal)).toBeCloseTo(4);
  });
  it("skips the weekend", () => {
    // Fri 15:00→17:00 (2h) + Sat/Sun (0) + Mon 09:00→11:00 (2h) = 4h
    expect(workingHoursElapsed(iso("2026-06-19T15:00"), iso("2026-06-22T11:00"), cal)).toBeCloseTo(4);
  });
  it("skips a holiday", () => {
    const withHoliday: BusinessCalendar = { ...cal, holidays: ["2026-06-16"] };
    // Mon 15:00→17:00 (2h) + Tue(holiday, 0) + Wed 09:00→11:00 (2h) = 4h
    expect(workingHoursElapsed(iso("2026-06-15T15:00"), iso("2026-06-17T11:00"), withHoliday)).toBeCloseTo(4);
  });
  it("hours outside the working window do not count", () => {
    // start before open, now after close, same day → only the 8h window
    expect(workingHoursElapsed(iso("2026-06-15T06:00"), iso("2026-06-15T22:00"), cal)).toBeCloseTo(8);
  });
});

describe("isHoldExpired (24 working hours = 3 business days)", () => {
  const held = iso("2026-06-15T09:00"); // Mon 09:00
  it("not expired one minute before the boundary", () => {
    // Mon(8) + Tue(8) + Wed 09:00→16:59 (7.983) = 23.98 < 24
    expect(isHoldExpired(held, iso("2026-06-17T16:59"), cal, 24)).toBe(false);
  });
  it("expired exactly at the 24-working-hour boundary", () => {
    // Mon(8) + Tue(8) + Wed 09:00→17:00 (8) = 24 >= 24
    expect(isHoldExpired(held, iso("2026-06-17T17:00"), cal, 24)).toBe(true);
  });
  it("not expired across just a weekend", () => {
    const fri = iso("2026-06-19T09:00");
    expect(isHoldExpired(fri, iso("2026-06-22T09:00"), cal, 24)).toBe(false); // only 8h elapsed (Fri)
  });
});

describe("holdExpiresAt", () => {
  it("24 working hrs from Mon 09:00 lands Wed 17:00", () => {
    expect(holdExpiresAt(iso("2026-06-15T09:00"), 24, cal)).toBe(iso("2026-06-17T17:00"));
  });
  it("carries a partial day across the weekend", () => {
    // Fri 16:00 (1h) → Mon(8) Tue(8) Wed 09:00+7h = Wed 16:00
    expect(holdExpiresAt(iso("2026-06-19T16:00"), 24, cal)).toBe(iso("2026-06-24T16:00"));
  });
  it("a hold placed outside hours starts counting at next open", () => {
    // Mon 06:00 → counts from Mon 09:00; 24h → Wed 17:00
    expect(holdExpiresAt(iso("2026-06-15T06:00"), 24, cal)).toBe(iso("2026-06-17T17:00"));
  });
  it("skips a holiday when advancing the expiry", () => {
    // Tue 2026-06-16 is a holiday → Mon(8)+[Tue skipped]+Wed(8)+Thu 09:00+8h = Thu 17:00
    const withHoliday: BusinessCalendar = { ...cal, holidays: ["2026-06-16"] };
    expect(holdExpiresAt(iso("2026-06-15T09:00"), 24, withHoliday)).toBe(iso("2026-06-18T17:00"));
  });
  it("returns the hold instant for a degenerate calendar (no working days)", () => {
    expect(holdExpiresAt(iso("2026-06-15T09:00"), 24, { ...cal, workingDays: [] })).toBe(iso("2026-06-15T09:00"));
  });
});

describe("defaultBusinessCalendar", () => {
  it("is Mon–Fri 09:00–17:00", () => {
    const d = defaultBusinessCalendar("Asia/Beirut");
    expect(d.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect([d.startHour, d.endHour]).toEqual([9, 17]);
    expect(d.timezone).toBe("Asia/Beirut");
  });
});

/**
 * The production calendar is Asia/Beirut, not UTC. Every ISO here is a real
 * instant (what `new Date().toISOString()` produces); the Beirut wall-clock it
 * denotes is in the comment. Beirut is UTC+3 in summer (EEST) and UTC+2 in
 * winter (EET) — the offset must be read per-instant, never assumed.
 *
 * Before the timezone fix these all failed: the 09:00–17:00 window was applied
 * in UTC, i.e. 12:00–20:00 Beirut.
 */
describe("Asia/Beirut — the window is local, not UTC", () => {
  const beirut: BusinessCalendar = { timezone: "Asia/Beirut", workingDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, holidays: [] };

  it("counts a morning inside the LOCAL working window", () => {
    // Mon 09:00 → 12:00 Beirut. Applied as UTC this window hasn't opened yet (0 hrs).
    expect(workingHoursElapsed("2026-06-15T06:00:00.000Z", "2026-06-15T09:00:00.000Z", beirut)).toBeCloseTo(3);
  });

  it("counts a full local working day as 8 hours", () => {
    // Mon 09:00 → 17:00 Beirut.
    expect(workingHoursElapsed("2026-06-15T06:00:00.000Z", "2026-06-15T14:00:00.000Z", beirut)).toBeCloseTo(8);
  });

  it("ignores local out-of-hours time", () => {
    // Mon 06:00 → 22:00 Beirut spans the whole day but only 09:00–17:00 counts.
    expect(workingHoursElapsed("2026-06-15T03:00:00.000Z", "2026-06-15T19:00:00.000Z", beirut)).toBeCloseTo(8);
  });

  it("expires 24 working hours after a Monday 09:00 local hold, at Wednesday 17:00 local", () => {
    // Mon 09:00 Beirut = 06:00Z; Wed 17:00 Beirut = 14:00Z.
    expect(holdExpiresAt("2026-06-15T06:00:00.000Z", 24, beirut)).toBe("2026-06-17T14:00:00.000Z");
  });

  it("holds the exact 24-working-hour boundary in local terms (both sides)", () => {
    const held = "2026-06-15T06:00:00.000Z"; // Mon 09:00 Beirut
    expect(isHoldExpired(held, "2026-06-17T13:59:00.000Z", beirut, 24)).toBe(false); // Wed 16:59 local
    expect(isHoldExpired(held, "2026-06-17T14:00:00.000Z", beirut, 24)).toBe(true); //  Wed 17:00 local
  });

  it("reads the winter offset (UTC+2), not a fixed summer one", () => {
    // Mon 2026-01-05: 06:00Z = 08:00 Beirut (before opening), 10:00Z = 12:00 Beirut.
    // So 09:00→12:00 local = 3 hrs. A hardcoded +3 would wrongly yield 4.
    expect(workingHoursElapsed("2026-01-05T06:00:00.000Z", "2026-01-05T10:00:00.000Z", beirut)).toBeCloseTo(3);
  });

  it("holdExpiresAt and isHoldExpired agree on the instant they return", () => {
    const held = "2026-06-15T06:00:00.000Z";
    const expires = holdExpiresAt(held, 24, beirut);
    expect(isHoldExpired(held, expires, beirut, 24)).toBe(true);
    // A minute, not a millisecond: workingHoursElapsed rounds to 1e-6 hours
    // (~3.6ms), so a 1ms step would round straight back to 24 and read expired.
    const aMinuteEarlier = new Date(new Date(expires).getTime() - 60_000).toISOString();
    expect(isHoldExpired(held, aMinuteEarlier, beirut, 24)).toBe(false);
  });

  it("falls back to UTC rather than throwing on an unknown zone", () => {
    const bogus: BusinessCalendar = { ...beirut, timezone: "Not/AZone" };
    expect(() => workingHoursElapsed(iso("2026-06-15T09:00"), iso("2026-06-15T12:00"), bogus)).not.toThrow();
    expect(workingHoursElapsed(iso("2026-06-15T09:00"), iso("2026-06-15T12:00"), bogus)).toBeCloseTo(3);
  });
});
