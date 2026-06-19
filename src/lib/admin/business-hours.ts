/**
 * Working-hours calendar (Exhibition Floor Plan, P1). Pure + deterministic +
 * client-safe. Used to expire reseller holds after N WORKING hours (default 24)
 * — nights, non-working days, and holidays do NOT count.
 *
 * DETERMINISM: `now` is always an argument; nothing here reads the system clock.
 * SIMPLIFICATION (locked decision): a single global calendar. The `timezone`
 * field is stored for display/future per-country use; the math treats the
 * incoming ISO instants as the calendar's local wall-clock (the dev-store seeds
 * + UI pass already-local ISO strings). Per-country tz conversion = later phase.
 */

export interface BusinessCalendar {
  timezone: string;
  /** Working weekdays, 0=Sun … 6=Sat. */
  workingDays: number[];
  /** Inclusive start hour (0–23) and exclusive end hour (1–24) of the work day. */
  startHour: number;
  endHour: number;
  /** Optional YYYY-MM-DD holiday dates that count as non-working. */
  holidays?: string[];
}

export function defaultBusinessCalendar(timezone = "Asia/Beirut"): BusinessCalendar {
  return { timezone, workingDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, holidays: [] };
}

const MS_PER_HOUR = 3_600_000;

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isWorkingDay(d: Date, cal: BusinessCalendar): boolean {
  if (!cal.workingDays.includes(d.getUTCDay())) return false;
  if (cal.holidays?.includes(ymd(d))) return false;
  return true;
}

/** Working hours in a single day between two instants on the SAME calendar day. */
function workingHoursWithinDay(from: Date, to: Date, cal: BusinessCalendar): number {
  if (!isWorkingDay(from, cal)) return 0;
  const dayStart = new Date(from);
  dayStart.setUTCHours(cal.startHour, 0, 0, 0);
  const dayEnd = new Date(from);
  dayEnd.setUTCHours(cal.endHour, 0, 0, 0);
  const lo = Math.max(from.getTime(), dayStart.getTime());
  const hi = Math.min(to.getTime(), dayEnd.getTime());
  return hi <= lo ? 0 : (hi - lo) / MS_PER_HOUR;
}

/**
 * Count ONLY business hours between two ISO instants. Skips nights, non-working
 * days, and holidays. Returns 0 if `now <= start`.
 */
export function workingHoursElapsed(startISO: string, nowISO: string, cal: BusinessCalendar): number {
  const start = new Date(startISO);
  const now = new Date(nowISO);
  if (now.getTime() <= start.getTime()) return 0;

  let total = 0;
  // Walk day by day from start's date to now's date.
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  const lastDay = new Date(now);
  lastDay.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= lastDay.getTime()) {
    const dayFrom = new Date(Math.max(cursor.getTime(), start.getTime()));
    const nextMidnight = new Date(cursor);
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
    const dayTo = new Date(Math.min(nextMidnight.getTime(), now.getTime()));
    // workingHoursWithinDay anchors isWorkingDay off `dayFrom` (same calendar
    // day as cursor) and returns 0 for nights / non-working days / holidays.
    total += workingHoursWithinDay(dayFrom, dayTo, cal);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.round(total * 1e6) / 1e6;
}

/** The wall-clock instant a hold lapses, advancing `allowed` working hours from `heldAt`. */
export function holdExpiresAt(heldAtISO: string, workingHoursAllowed: number, cal: BusinessCalendar): string {
  let remaining = workingHoursAllowed;
  const cursor = new Date(heldAtISO);

  // Safety bound: never loop more than ~1000 days.
  for (let guard = 0; guard < 24_000 && remaining > 1e-9; guard++) {
    if (!isWorkingDay(cursor, cal)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(cal.startHour, 0, 0, 0);
      continue;
    }
    const dayStart = new Date(cursor); dayStart.setUTCHours(cal.startHour, 0, 0, 0);
    const dayEnd = new Date(cursor); dayEnd.setUTCHours(cal.endHour, 0, 0, 0);
    // Clamp cursor into the working window.
    if (cursor.getTime() < dayStart.getTime()) cursor.setTime(dayStart.getTime());
    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(cal.startHour, 0, 0, 0);
      continue;
    }
    const availableToday = (dayEnd.getTime() - cursor.getTime()) / MS_PER_HOUR;
    if (remaining <= availableToday) {
      cursor.setTime(cursor.getTime() + remaining * MS_PER_HOUR);
      remaining = 0;
    } else {
      remaining -= availableToday;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(cal.startHour, 0, 0, 0);
    }
  }
  return cursor.toISOString();
}

export function isHoldExpired(heldAtISO: string, nowISO: string, cal: BusinessCalendar, workingHoursAllowed = 24): boolean {
  return workingHoursElapsed(heldAtISO, nowISO, cal) >= workingHoursAllowed;
}
