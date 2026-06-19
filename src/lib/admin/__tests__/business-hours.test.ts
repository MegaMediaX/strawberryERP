import { describe, expect, it } from "vitest";

import {
  defaultBusinessCalendar,
  holdExpiresAt,
  isHoldExpired,
  workingHoursElapsed,
  type BusinessCalendar,
} from "@/lib/admin/business-hours";

// 2026-06-15 is a Monday. Calendar: Mon–Fri (1–5), 09:00–17:00 UTC = 8 working hrs/day.
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
});

describe("defaultBusinessCalendar", () => {
  it("is Mon–Fri 09:00–17:00", () => {
    const d = defaultBusinessCalendar("Asia/Beirut");
    expect(d.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect([d.startHour, d.endHour]).toEqual([9, 17]);
    expect(d.timezone).toBe("Asia/Beirut");
  });
});
