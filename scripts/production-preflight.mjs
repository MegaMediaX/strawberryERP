import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const failures = [];
const warnings = [];
const env = loadConfiguration();

function loadConfiguration() {
  const envFile = process.env.PRODUCTION_ENV_FILE;
  const fromFile = envFile ? parseEnvFile(envFile) : {};
  return { ...fromFile, ...process.env };
}

function parseEnvFile(file) {
  if (!existsSync(file)) {
    throw new Error(`Production environment file does not exist: ${file}`);
  }

  const parsed = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function pass(label) {
  console.log(`PASS ${label}`);
}

function fail(label, reason) {
  failures.push(`${label}: ${reason}`);
  console.error(`FAIL ${label}`);
}

function check(label, condition, reason) {
  if (condition) pass(label);
  else fail(label, reason);
}

function required(name) {
  const value = runtimeValue(name);
  check(`${name} is configured`, Boolean(value), "missing value");
  return value || "";
}

function runtimeValue(name) {
  const direct = env[name]?.trim();
  if (direct) return direct;
  const file = env[`${name}_FILE`]?.trim();
  if (!file || !existsSync(file)) return "";
  return readFileSync(file, "utf8").trim();
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "change-me" ||
    normalized.startsWith("change-this") ||
    normalized.startsWith("replace-") ||
    normalized.startsWith("your-") ||
    normalized.includes("example.com") ||
    normalized.includes("example.local")
  );
}

function secret(name, minimumLength) {
  const value = required(name);
  check(`${name} is not a placeholder`, !isPlaceholder(value), "placeholder values are forbidden");
  check(`${name} meets minimum length`, value.length >= minimumLength, `must be at least ${minimumLength} characters`);
}

function pinnedImage(name) {
  const value = required(name);
  check(`${name} uses an immutable digest`, /@sha256:[a-f0-9]{64}$/i.test(value), "image must end with an sha256 digest");
}

function validUrl(name, { https = false } = {}) {
  const value = required(name);
  try {
    const url = new URL(value);
    check(`${name} has an allowed protocol`, https ? url.protocol === "https:" : ["http:", "https:"].includes(url.protocol), https ? "HTTPS is required" : "HTTP or HTTPS is required");
    check(`${name} is not an example hostname`, !isPlaceholder(url.hostname), "example hostnames are forbidden");
  } catch {
    fail(`${name} is a valid URL`, "invalid URL");
  }
}

validUrl("PUBLIC_BASE_URL", { https: true });
validUrl("FRAPPE_BASE_URL");
required("FRAPPE_HOST_HEADER");
required("SITE_NAME");
secret("FRAPPE_API_KEY", 12);
secret("FRAPPE_API_SECRET", 15);
secret("PORTAL_SESSION_SECRET", 32);
secret("PORTAL_API_KEY_SECRET", 32);
secret("API_KEY_HASH_SECRET", 32);
secret("MARIADB_ROOT_PASSWORD", 20);
secret("MARIADB_PASSWORD", 20);

for (const image of ["ERPNEXT_IMAGE", "MARIADB_IMAGE", "REDIS_IMAGE", "NGINX_IMAGE"]) {
  pinnedImage(image);
}
check("frappe/erpnext:latest is not configured", !/frappe\/erpnext:latest/i.test(env.ERPNEXT_IMAGE || ""), "latest tags are forbidden");

const backupDirectory = required("BACKUP_EXPORT_DIR");
check("BACKUP_EXPORT_DIR is not inside the repository", !/^[.]?[\\/]?backups$/i.test(backupDirectory), "production backups must be staged outside the application checkout");
const retentionDays = Number(required("BACKUP_RETENTION_DAYS"));
check("BACKUP_RETENTION_DAYS is at least 7", Number.isInteger(retentionDays) && retentionDays >= 7, "use an integer of at least 7 days");

const compose = readFileSync("docker-compose.yml", "utf8");
const nginx = readFileSync("infra/nginx/default.conf", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");

check("Frappe host port is loopback-bound", compose.includes('127.0.0.1:${FRAPPE_PORT:-8000}:8000'), "backend must not bind to all interfaces");
check("Frontend healthcheck uses readiness", compose.includes("/api/health/ready"), "readiness endpoint is not wired into Compose");
check("Public generic Frappe tunnel is disabled", /location \^~ \/erpnext-api\/[\s\S]*?return 404;/.test(nginx), "generic Frappe proxy must return 404");
check("NGINX API rate limiting is enabled", nginx.includes("limit_req zone=portal_api"), "portal API rate limiting is missing");
check("NGINX request IDs are enabled", nginx.includes("X-Request-ID $request_id"), "request IDs are missing");
check("Next.js technology header is disabled", nextConfig.includes("poweredByHeader: false"), "powered-by header must be disabled");
check("Liveness route exists", existsSync("src/app/api/health/live/route.ts"), "liveness endpoint is missing");
check("Readiness route exists", existsSync("src/app/api/health/ready/route.ts"), "readiness endpoint is missing");
check("Aggregate health route exists", existsSync("src/app/api/health/route.ts"), "aggregate health endpoint is missing");
check("Production TLS template exists", existsSync("deploy/nginx/production.conf.example"), "production TLS template is missing");
check("Production environment example exists", existsSync(".env.production.example"), "production environment example is missing");

const composeResult = spawnSync("docker", ["compose", "config", "--quiet"], { encoding: "utf8", env });
check("Docker Compose configuration is valid", composeResult.status === 0, "docker compose config --quiet failed");

const gitignore = readFileSync(".gitignore", "utf8");
check("Environment files are ignored", /^\.env\*$/m.test(gitignore), ".env* must remain ignored");
const trackedEnvironmentFiles = trackedFiles().filter(
  (file) => /^\.env(?:\..+)?$/i.test(file) && !/\.example$/i.test(file),
);
check("No environment files are committed", trackedEnvironmentFiles.length === 0, "tracked non-example environment files were detected");

for (const optional of ["SMTP_HOST", "GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_ID", "META_WHATSAPP_ACCESS_TOKEN", "WASENDER_API_KEY"]) {
  if (!env[optional]) warnings.push(`${optional} is not configured`);
}

if (env.PREFLIGHT_PROBE_BASE_URL) {
  await probeRuntime(env.PREFLIGHT_PROBE_BASE_URL);
}

if (env.PREFLIGHT_BACKUP_BUNDLE_DIR) {
  const verification = spawnSync(process.execPath, ["scripts/verify-backup.mjs", env.PREFLIGHT_BACKUP_BUNDLE_DIR], {
    encoding: "utf8",
    env,
  });
  check("Backup manifest verification passes", verification.status === 0, "backup verification failed");
}

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (failures.length) {
  console.error(`Production preflight failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("PASS production preflight");

async function probeRuntime(baseUrl) {
  for (const endpoint of ["", "/live", "/ready"]) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health${endpoint}`, {
        signal: AbortSignal.timeout(10_000),
      });
      check(`Runtime health${endpoint || "/"} probe`, response.ok, `received HTTP ${response.status}`);
    } catch {
      fail(`Runtime health${endpoint || "/"} probe`, "request failed");
    }
  }

  try {
    const blocked = await fetch(`${baseUrl.replace(/\/$/, "")}/erpnext-api/api/method/ping`, {
      signal: AbortSignal.timeout(10_000),
    });
    check("Runtime generic Frappe tunnel is blocked", blocked.status === 404, `received HTTP ${blocked.status}`);
  } catch {
    fail("Runtime generic Frappe tunnel is blocked", "request failed");
  }

  try {
    const deleted = await fetch(`${baseUrl.replace(/\/$/, "")}/api/frappe/invoices`, {
      method: "DELETE",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await deleted.json();
    check(
      "Runtime HTTP DELETE is blocked",
      deleted.status === 405 && body?.error?.code === "METHOD_NOT_ALLOWED",
      `received HTTP ${deleted.status}`,
    );
  } catch {
    fail("Runtime HTTP DELETE is blocked", "request failed");
  }
}

function trackedFiles() {
  if (!existsSync(".git")) return [];
  const result = spawnSync("git", ["ls-files"], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).filter(Boolean);
}
