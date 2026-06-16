import type { ApiKeyRecord, ApiLog, ApiScope } from "@/lib/phase2-data";

/**
 * Super Admin API Developer Center (spec §23). Pure + unit-testable helpers
 * for key-status derivation, plain-language scope grouping, and log filtering.
 * Key generation + the delete-scope block live in `phase2-data`
 * (`generateApiKeyRecord` / `validateApiKeyPayload`) and are reused as-is.
 * INVARIANT: there is NO delete scope anywhere — `apiScopes` only has read/write.
 */

/**
 * Local literal mirror of `apiScopes` (phase2-data). Kept as a plain literal so
 * client components can import it WITHOUT pulling phase2-data's `node:fs`
 * transitive dependency into the browser bundle. A test asserts parity.
 */
export const API_SCOPE_LIST: ApiScope[] = [
  "read:leads", "write:leads",
  "read:customers", "write:customers",
  "read:invoices", "write:invoices",
  "read:receipts", "write:receipts",
  "read:resellers", "write:resellers",
  "read:reports",
  "read:commissions",
];

export type ApiKeyStatus = "Active" | "Expired" | "Revoked";

/** Derive a display status. Revoked wins; then expiry; else active. */
export function apiKeyStatus(key: Pick<ApiKeyRecord, "isActive" | "revokedAt" | "expiresAt">, now: Date): ApiKeyStatus {
  if (!key.isActive || key.revokedAt) return "Revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() < now.getTime()) return "Expired";
  return "Active";
}

export interface ScopeModuleRow {
  module: string;
  read?: ApiScope;
  write?: ApiScope;
}

/** Pre-grouped module rows for the key-generation UI (client-safe). */
export const SCOPE_MODULES: ScopeModuleRow[] = groupScopesImpl(API_SCOPE_LIST);

/** Group flat `read:leads` scopes into per-module rows for plain-language toggles. */
export function groupScopes(scopes: readonly ApiScope[]): ScopeModuleRow[] {
  return groupScopesImpl(scopes);
}

function groupScopesImpl(scopes: readonly ApiScope[]): ScopeModuleRow[] {
  const map = new Map<string, ScopeModuleRow>();
  for (const scope of scopes) {
    const [access, module] = scope.split(":") as ["read" | "write", string];
    const row = map.get(module) ?? { module };
    if (access === "read") row.read = scope;
    if (access === "write") row.write = scope;
    map.set(module, row);
  }
  return [...map.values()];
}

export interface ApiLogFilters {
  apiKey?: string;
  method?: ApiLog["method"];
  status?: "success" | "error";
  endpoint?: string;
  ipAddress?: string;
}

export function filterApiLogs(logs: readonly ApiLog[], f: ApiLogFilters): ApiLog[] {
  return logs.filter((l) => {
    if (f.apiKey && l.apiKey !== f.apiKey) return false;
    if (f.method && l.method !== f.method) return false;
    if (f.status === "success" && l.statusCode >= 400) return false;
    if (f.status === "error" && l.statusCode < 400) return false;
    if (f.endpoint && !l.endpoint.toLowerCase().includes(f.endpoint.toLowerCase())) return false;
    if (f.ipAddress && l.ipAddress !== f.ipAddress) return false;
    return true;
  });
}

/** Overview tallies for the API center landing page. */
export function apiKeyOverview(keys: readonly ApiKeyRecord[], logs: readonly ApiLog[], now: Date) {
  let active = 0;
  for (const k of keys) if (apiKeyStatus(k, now) === "Active") active += 1;
  const failed = logs.filter((l) => l.statusCode >= 400).length;
  return { total: keys.length, active, revoked: keys.length - active, requests: logs.length, failed };
}

/** §23 documentation endpoint catalog — read/create/update only; NO delete. */
export const API_ENDPOINTS: { method: ApiLog["method"]; path: string; scope: string; description: string }[] = [
  { method: "GET", path: "/api/frappe/leads", scope: "read:leads", description: "List leads (scoped + paginated)." },
  { method: "POST", path: "/api/frappe/leads", scope: "write:leads", description: "Create a lead." },
  { method: "PATCH", path: "/api/frappe/leads/:id", scope: "write:leads", description: "Update a lead." },
  { method: "GET", path: "/api/frappe/customers", scope: "read:customers", description: "List customers." },
  { method: "GET", path: "/api/frappe/invoices", scope: "read:invoices", description: "List invoices." },
  { method: "POST", path: "/api/frappe/invoices", scope: "write:invoices", description: "Create an invoice." },
  { method: "GET", path: "/api/frappe/receipts", scope: "read:receipts", description: "List receipts." },
  { method: "GET", path: "/api/frappe/reports", scope: "read:reports", description: "Read report aggregates." },
];
