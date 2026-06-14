import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Inject ONLY the seed-password vars (SEED_*) from the untracked `.env` into
 * process.env for tests, without adding a dotenv dependency. This keeps the
 * seed passwords out of committed source while leaving the rest of the test
 * environment hermetic. Loading the full `.env` would set the Frappe/Docker
 * config and flip code paths (e.g. proxy to a live backend) that tests assume
 * are unset. Existing process.env values win, so CI-injected secrets stand.
 */
try {
  const envPath = fileURLToPath(new URL("./.env", import.meta.url));
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
  // .env is optional; CI may inject the required SEED_* vars directly.
}
