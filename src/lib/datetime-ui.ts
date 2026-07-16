/**
 * Client-safe date/time rendering, shared by the admin, reseller, regional and
 * platform views. No runtime imports from phase2-data or dev-store, so
 * `"use client"` components can import it freely.
 *
 * WHY THIS EXISTS: these views used to render timestamps by slicing the raw ISO
 * string (`iso.slice(0, 16).replace("T", " ")`). Stored timestamps are UTC
 * INSTANTS, so slicing shows UTC to everyone — a Beirut admin saw "09:30" for
 * something that happened at 12:30 their time. Format against the platform
 * timezone (`platformSettings.general.defaultTimezone`) instead.
 *
 * INSTANTS vs DAYS — the distinction matters:
 *  - An instant ("2026-06-08T09:30:00Z") has a zone and MUST be converted.
 *  - A date-only value ("2026-12-31") has NO zone and must NOT be: parsing it as
 *    UTC midnight and converting would shift it a day backwards at any negative
 *    offset. Render those with `formatDay`.
 *
 * Why the platform zone rather than the viewer's, and why every locale here is
 * pinned: these components are server-rendered and then hydrated, so anything
 * resolved from the runtime (the ambient locale, the ambient zone) can differ
 * between the two renders and trip a React hydration mismatch. Both are explicit.
 */

/**
 * One formatter per (cache, zone). Construction is expensive, and these run on
 * every render.
 *
 * The UTC fallback keeps an unknown zone from taking down every page.
 * `validateGeneral` rejects a non-IANA zone at the settings boundary, so this
 * should be unreachable — but it is the last line of defence, and falling back is
 * the right failure mode for a formatter. Note the trade-off: because this
 * degrades silently rather than throwing, the settings boundary is the ONLY place
 * a bad zone gets reported. Keep that validation.
 */
function cachedFormatter(
  cache: Map<string, Intl.DateTimeFormat>,
  locale: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string,
): Intl.DateTimeFormat {
  const cached = cache.get(timeZone);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
  } catch {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  }
  cache.set(timeZone, formatter);
  return formatter;
}

const PART_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const LONG_DAY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const LABEL_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

// hourCycle "h23" rather than hour12:false — the latter yields hour "24" at
// midnight on some engines.
const PART_OPTIONS: Intl.DateTimeFormatOptions = {
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit",
};
const LONG_DAY_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
const LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short", day: "2-digit", month: "short",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
};

function partsIn(iso: string, timeZone: string) {
  const parts = cachedFormatter(PART_FORMATTERS, "en-US", PART_OPTIONS, timeZone).formatToParts(new Date(iso));
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: at("year"), month: at("month"), day: at("day"), hour: at("hour"), minute: at("minute") };
}

/**
 * An instant as `2026-06-08 12:30` in `timeZone` — the same shape the old ISO
 * slice produced, so table layouts are unchanged; only the value is now correct.
 */
export function formatInstant(iso: string, timeZone: string, fallback = "—"): string {
  if (!iso) return fallback;
  const { year, month, day, hour, minute } = partsIn(iso, timeZone);
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/** An instant reduced to its calendar day IN `timeZone` — `2026-06-08`. */
export function formatInstantDate(iso: string, timeZone: string, fallback = "—"): string {
  if (!iso) return fallback;
  const { year, month, day } = partsIn(iso, timeZone);
  return `${year}-${month}-${day}`;
}

/**
 * A date-only value (`2026-12-31`). Deliberately NOT zone-converted: it denotes a
 * calendar day, not a moment, and converting would shift it.
 */
export function formatDay(value: string, fallback = "—"): string {
  return value ? value.slice(0, 10) : fallback;
}

/** An instant as a friendly day — `5 Jun 2026` — in `timeZone`. */
export function formatInstantDayLong(iso: string, timeZone: string, fallback = "—"): string {
  if (!iso) return fallback;
  return cachedFormatter(LONG_DAY_FORMATTERS, "en-GB", LONG_DAY_OPTIONS, timeZone).format(new Date(iso));
}

/** An instant as `Wed, 17 Jun, 17:00` in `timeZone` — for slot hold expiry. */
export function formatInZone(iso: string, timeZone: string, fallback = "—"): string {
  if (!iso) return fallback;
  return cachedFormatter(LABEL_FORMATTERS, "en-GB", LABEL_OPTIONS, timeZone).format(new Date(iso));
}
