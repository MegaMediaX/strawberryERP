/**
 * Seed login passwords for tests and smoke scripts.
 *
 * Read from the environment so plaintext bootstrap credentials are NOT committed
 * to the repository. The real dev values live in the untracked `.env` (or a
 * local `.env.test`) file — see docs/testing/auth-test-credentials.md — and
 * match the scrypt hashes seeded in `src/lib/auth/credentials.ts`. In CI,
 * inject these via secrets.
 *
 * Only SEED_ADMIN_PW is a true secret: it must match the committed scrypt hash
 * for the real Super Admin seed (ggkhoueiry@gmail.com), which is identical to
 * prod. It is intentionally left `undefined` when not supplied, so importing
 * this module never throws — consumers that need it wrap their assertions in
 * `describe.skipIf(!SEED_ADMIN_PW)` (see the auth/session/2FA test files)
 * instead of crashing the whole file at import time.
 *
 * The other three (REGIONAL/RESELLER/SALES) are NOT real secrets: no unit-test
 * assertion authenticates with them directly today (only SEED_LOGINS below,
 * consumed by live-smoke scripts, references them). vitest.setup.ts applies
 * committed, non-sensitive fallback values for local/CI runs that don't set
 * them, so they are always defined and never throw either.
 */
export const SEED_ADMIN_PW: string | undefined = process.env.SEED_ADMIN_PW || undefined;

function withFallback(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

// Keep these fallbacks in sync with the CI-hardcoded literals in
// .github/workflows/ci.yml — both exist purely to satisfy the shape of
// SEED_LOGINS/live-smoke scripts and never gate a real credential check.
export const SEED_REGIONAL_PW = withFallback("SEED_REGIONAL_PW", "test-only-regional-pw");
export const SEED_RESELLER_PW = withFallback("SEED_RESELLER_PW", "test-only-reseller-pw");
export const SEED_SALES_PW = withFallback("SEED_SALES_PW", "test-only-sales-pw");

export const SEED_SUPER_EMAIL = "ggkhoueiry@gmail.com";

export const SEED_LOGINS = [
  { name: "Super Admin", email: SEED_SUPER_EMAIL, password: SEED_ADMIN_PW },
  { name: "Regional Director", email: "maya.regional@lebtech.example", password: SEED_REGIONAL_PW },
  { name: "Reseller Admin", email: "admin@beirutdigital.example", password: SEED_RESELLER_PW },
  { name: "Sales Team User", email: "m.elmouallem@leb-tech.com", password: SEED_SALES_PW },
] as const;
