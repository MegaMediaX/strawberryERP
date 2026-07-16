/**
 * Working-hours calendar (Exhibition Floor Plan, P1). Pure + deterministic +
 * client-safe. Used to expire reseller holds after N WORKING hours (default 24)
 * — nights, non-working days, and holidays do NOT count.
 *
 * DETERMINISM: `now` is always an argument; nothing here reads the system clock.
 *
 * TIMEZONE: every ISO string crossing this boundary is a real INSTANT (what
 * `new Date().toISOString()` produces). `cal.timezone` is authoritative: instants
 * are converted to that zone's wall-clock ONCE on the way in, all day-walking
 * arithmetic runs on wall-clock values, and `holdExpiresAt` converts back to an
 * instant on the way out. So "Mon–Fri 09:00–17:00" means 09:00–17:00 in
 * `cal.timezone`, not in UTC, and the weekday is that zone's weekday.
 *
 * Counting in wall-clock is deliberate: a working day is 8 hours "by the clock on
 * the wall" even across a DST shift, which is what a business calendar means.
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

/**
 * `timezone` is required on purpose. A default here would let a caller omit it and
 * silently get one country's zone regardless of platform settings — pass
 * `platformSettings.general.defaultTimezone`, which is the spec's source of truth.
 */
export function defaultBusinessCalendar(timezone: string): BusinessCalendar {
  return { timezone, workingDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, holidays: [] };
}

const MS_PER_HOUR = 3_600_000;

// Intl.DateTimeFormat construction is expensive; one per zone is plenty.
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = FORMATTERS.get(timeZone);
  if (cached) return cached;
  const options: Intl.DateTimeFormatOptions = {
    hourCycle: "h23", // not hour12:false — that yields hour "24" at midnight on some engines
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
  } catch {
    // An unknown zone would otherwise throw on every render. Degrade to UTC —
    // wrong-but-serving beats a 500. `validateGeneral` is the boundary that
    // rejects a bad zone; because this degrades silently rather than throwing,
    // that validation is the only place a bad zone is ever reported. Keep it.
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  }
  FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/**
 * An instant's wall-clock in `timeZone`, carried as a Date whose UTC fields ARE
 * those local components. Every helper below then does plain UTC-field
 * arithmetic (getUTCHours, setUTCHours, getUTCDay) and is therefore reading
 * local time by construction.
 */
function toWallClock(instant: Date, timeZone: string): Date {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(at("year"), at("month") - 1, at("day"), at("hour"), at("minute"), at("second"), instant.getUTCMilliseconds()));
}

/** The UTC offset (ms) in effect in `timeZone` at `instant`. */
function offsetMs(instant: Date, timeZone: string): number {
  return toWallClock(instant, timeZone).getTime() - instant.getTime();
}

/**
 * Inverse of `toWallClock`: the real instant whose `timeZone` wall-clock is
 * `wall`. Two passes, because the offset at the first guess can differ from the
 * offset at the true instant across a DST boundary.
 */
function fromWallClock(wall: Date, timeZone: string): Date {
  const guess = new Date(wall.getTime() - offsetMs(wall, timeZone));
  return new Date(wall.getTime() - offsetMs(guess, timeZone));
}

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
  // Instants in, wall-clock out: everything below counts against cal.timezone.
  const start = toWallClock(new Date(startISO), cal.timezone);
  const now = toWallClock(new Date(nowISO), cal.timezone);
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
  // Degenerate calendar (no working days): a hold can never accrue working time,
  // so it never lapses — return the hold instant rather than spinning the guard
  // loop to a date decades out.
  if (cal.workingDays.length === 0 || cal.endHour <= cal.startHour) return heldAtISO;
  let remaining = workingHoursAllowed;
  // Walk forward in cal.timezone wall-clock, then convert back to an instant.
  const cursor = toWallClock(new Date(heldAtISO), cal.timezone);

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
  return fromWallClock(cursor, cal.timezone).toISOString();
}

export function isHoldExpired(heldAtISO: string, nowISO: string, cal: BusinessCalendar, workingHoursAllowed = 24): boolean {
  return workingHoursElapsed(heldAtISO, nowISO, cal) >= workingHoursAllowed;
}
