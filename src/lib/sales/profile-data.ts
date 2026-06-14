/**
 * Sales profile read-only fields (spec §22). Pure + unit-testable. Timezone is
 * derived from the user's country (PortalUser carries no tz field yet).
 */

const COUNTRY_TZ: Record<string, string> = {
  Lebanon: "Asia/Beirut",
  Cyprus: "Asia/Nicosia",
  Jordan: "Asia/Amman",
  Syria: "Asia/Damascus",
};

const DEFAULT_TZ = "Asia/Beirut";

/** Friendly role label (currently a pass-through; centralised for future tweaks). */
export function formatRole(role: string): string {
  return role;
}

/** Best-effort timezone label from the user's first assigned country. */
export function getTimezoneLabel(countries: readonly string[]): string {
  for (const c of countries) {
    if (COUNTRY_TZ[c]) return COUNTRY_TZ[c];
  }
  return DEFAULT_TZ;
}
