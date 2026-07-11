/**
 * Environment-driven configuration. All gates default OFF; prod requires an
 * explicit MCP_PROD_CONFIRMED=true or the server refuses to start. Secrets are
 * only ever read from env — never committed, never logged.
 */

export type McpTarget = "local" | "prod";

export interface McpConfig {
  target: McpTarget;
  portalBaseUrl: string;
  portalSessionSecret: string;
  portalUserId: string;
  sessionTtlMs: number;
  writesEnabled: boolean;
  destructiveEnabled: boolean;
  frappeTierEnabled: boolean;
  frappeBaseUrl?: string;
  frappeHostHeader?: string;
  frappeApiKey?: string;
  frappeApiSecret?: string;
}

export class ConfigError extends Error {}

const PROD_PORTAL_URL = "https://strawberryerp.srv1259241.hstgr.cloud";
const LOCAL_PORTAL_URL = "http://127.0.0.1:3000";
const LOCAL_FRAPPE_URL = "http://127.0.0.1:8001";
const LOCAL_FRAPPE_HOST = "lebtech.local";

function flag(env: NodeJS.ProcessEnv, name: string): boolean {
  return env[name] === "true";
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const target = (env.MCP_TARGET ?? "local") as McpTarget;
  if (target !== "local" && target !== "prod") {
    throw new ConfigError(`MCP_TARGET must be "local" or "prod" (got "${env.MCP_TARGET}")`);
  }
  if (target === "prod" && !flag(env, "MCP_PROD_CONFIRMED")) {
    throw new ConfigError(
      "MCP_TARGET=prod requires MCP_PROD_CONFIRMED=true. Refusing to start against production without explicit confirmation.",
    );
  }

  const portalBaseUrl = stripSlash(
    env.PORTAL_BASE_URL ?? (target === "prod" ? PROD_PORTAL_URL : LOCAL_PORTAL_URL),
  );
  // Guard: prod portal is served on 443 behind nginx — host port 3000 on the
  // shared box belongs to a DIFFERENT tenant. Never allow it.
  if (target === "prod" && /:3000(\/|$)/.test(portalBaseUrl)) {
    throw new ConfigError("PORTAL_BASE_URL on port 3000 is not allowed for MCP_TARGET=prod (different tenant on the shared box).");
  }

  const portalSessionSecret = env.PORTAL_SESSION_SECRET ?? "";
  if (!portalSessionSecret) {
    throw new ConfigError("PORTAL_SESSION_SECRET is required (used to mint the lebtech_session cookie). Set it in the environment.");
  }

  const writesEnabled = flag(env, "MCP_WRITES_ENABLED");
  const destructiveEnabled = flag(env, "MCP_DESTRUCTIVE_ENABLED");
  const frappeTierEnabled = flag(env, "MCP_FRAPPE_TIER_ENABLED");

  let frappeBaseUrl: string | undefined;
  let frappeHostHeader: string | undefined;
  let frappeApiKey: string | undefined;
  let frappeApiSecret: string | undefined;
  if (frappeTierEnabled) {
    frappeBaseUrl = env.FRAPPE_BASE_URL ? stripSlash(env.FRAPPE_BASE_URL) : target === "local" ? LOCAL_FRAPPE_URL : undefined;
    if (!frappeBaseUrl) {
      throw new ConfigError("MCP_FRAPPE_TIER_ENABLED=true with MCP_TARGET=prod requires an explicit FRAPPE_BASE_URL.");
    }
    frappeHostHeader = env.FRAPPE_HOST_HEADER ?? (target === "local" ? LOCAL_FRAPPE_HOST : undefined);
    frappeApiKey = env.FRAPPE_API_KEY;
    frappeApiSecret = env.FRAPPE_API_SECRET;
    if (!frappeApiKey || !frappeApiSecret) {
      throw new ConfigError("MCP_FRAPPE_TIER_ENABLED=true requires FRAPPE_API_KEY and FRAPPE_API_SECRET.");
    }
  }

  const ttlMinutes = Number(env.MCP_SESSION_TTL_MINUTES ?? "60");
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    throw new ConfigError("MCP_SESSION_TTL_MINUTES must be a positive number.");
  }

  return {
    target,
    portalBaseUrl,
    portalSessionSecret,
    portalUserId: env.MCP_PORTAL_USER ?? "USR-SUPER",
    sessionTtlMs: ttlMinutes * 60_000,
    writesEnabled,
    destructiveEnabled,
    frappeTierEnabled,
    frappeBaseUrl,
    frappeHostHeader,
    frappeApiKey,
    frappeApiSecret,
  };
}

/** Every secret value the config knows about — used to redact outbound messages. */
export function secretValues(config: McpConfig): string[] {
  return [config.portalSessionSecret, config.frappeApiKey, config.frappeApiSecret].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}
