import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Inject ONLY the seed-password vars (SEED_*) from an untracked env file into
 * process.env for tests, without adding a dotenv dependency. This keeps the
 * seed passwords out of committed source while leaving the rest of the test
 * environment hermetic. Loading the full `.env` would set the Frappe/Docker
 * config and flip code paths (e.g. proxy to a live backend) that tests assume
 * are unset. Existing process.env values win, so CI-injected secrets stand.
 */
function loadSeedVarsFrom(relativePath: string): void {
  try {
    const envPath = fileURLToPath(new URL(relativePath, import.meta.url));
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(SEED_[A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Optional file; CI may inject the required SEED_* vars directly.
  }
}

// `.env` first (shared dev bootstrap file), then `.env.test` (gitignored,
// test-only override — lets a dev set just the seed passwords without the
// full Frappe/Docker `.env`). Both are optional; first-set-wins per key.
loadSeedVarsFrom("./.env");
loadSeedVarsFrom("./.env.test");

/**
 * Only SEED_ADMIN_PW is a true secret (it must match the real, prod-identical
 * Super Admin scrypt hash) — it is intentionally left unset here when no env
 * file/CI secret supplies it; consuming tests skip cleanly instead (see
 * `describe.skipIf(!SEED_ADMIN_PW)` in the auth/session/2FA test files).
 *
 * The other three seed passwords are NOT real secrets: no test assertion
 * authenticates with them directly today. Apply committed, non-sensitive
 * fallbacks so a fresh clone with no env files never fails to even import
 * `src/test/seed-credentials.ts`. Keep these in sync with the CI-hardcoded
 * literals in .github/workflows/ci.yml.
 */
const NON_SECRET_SEED_FALLBACKS: Record<string, string> = {
  SEED_REGIONAL_PW: "test-only-regional-pw",
  SEED_RESELLER_PW: "test-only-reseller-pw",
  SEED_SALES_PW: "test-only-sales-pw",
};
for (const [key, fallback] of Object.entries(NON_SECRET_SEED_FALLBACKS)) {
  if (!process.env[key]) process.env[key] = fallback;
}
