import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Load the untracked ../.env into process.env for smoke scripts (no dotenv dep).
// Existing process.env values win, so CLI/CI-provided overrides are respected.
try {
  const envPath = fileURLToPath(new URL("../.env", import.meta.url));
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
} catch {
  // .env optional; vars may be provided directly in the environment.
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Set seed passwords in .env (see .env.example).`);
    process.exit(2);
  }
  return value;
}
