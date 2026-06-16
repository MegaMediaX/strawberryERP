import { describe, expect, it } from "vitest";

import {
  apiKeyOverview,
  apiKeyStatus,
  filterApiLogs,
  groupScopes,
} from "@/lib/admin/api-center";
import { API_SCOPE_LIST } from "@/lib/admin/api-center";
import { apiScopes, validateApiKeyPayload, type ApiKeyRecord, type ApiLog } from "@/lib/phase2-data";

const key = (over: Partial<ApiKeyRecord>): ApiKeyRecord => ({
  id: "K1", keyName: "k", description: "", keyHash: "h", prefix: "ltp_live_x",
  scopes: ["read:leads"], readAccess: true, writeAccess: false, expiresAt: "2026-12-31",
  ipWhitelist: [], rateLimitPerMinute: 60, isActive: true, createdBy: "Super Admin", lastUsedAt: "",
  ...over,
});

const log = (over: Partial<ApiLog>): ApiLog => ({
  id: "L1", apiKey: "LT-DEV-03", endpoint: "/api/frappe/leads", method: "GET",
  ipAddress: "203.0.113.10", userAgent: "ua", statusCode: 200, responseTimeMs: 80,
  createdAt: "2026-06-07T08:00:00Z", ...over,
});

describe("apiKeyStatus (spec §23)", () => {
  const now = new Date("2026-06-16");
  it("active when isActive, not revoked, not expired", () => {
    expect(apiKeyStatus(key({}), now)).toBe("Active");
  });
  it("revoked when isActive false or revokedAt set", () => {
    expect(apiKeyStatus(key({ isActive: false }), now)).toBe("Revoked");
    expect(apiKeyStatus(key({ revokedAt: "2026-06-10" }), now)).toBe("Revoked");
  });
  it("expired when past expiresAt", () => {
    expect(apiKeyStatus(key({ expiresAt: "2026-01-01" }), now)).toBe("Expired");
  });
});

describe("NO delete scope invariant (spec §23/§42)", () => {
  it("apiScopes has no delete scope", () => {
    expect(apiScopes.some((s) => s.includes("delete"))).toBe(false);
  });
  it("client-safe API_SCOPE_LIST mirrors apiScopes exactly", () => {
    expect([...API_SCOPE_LIST].sort()).toEqual([...apiScopes].sort());
  });
  it("validateApiKeyPayload rejects any delete scope", () => {
    // Rejected as unsupported (delete scopes aren't even in apiScopes — doubly safe).
    expect(validateApiKeyPayload({ scopes: ["delete:leads"], readAccess: true })).not.toBeNull();
    // The dedicated delete-scope guard also fires for a recognized module + delete verb.
    expect(validateApiKeyPayload({ scopes: ["read:leads", "delete:invoices"], readAccess: true })).toMatch(/delete|Delete/);
  });
});

describe("groupScopes", () => {
  it("groups read/write per module", () => {
    expect(groupScopes(["read:leads", "write:leads", "read:invoices"])).toEqual([
      { module: "leads", read: "read:leads", write: "write:leads" },
      { module: "invoices", read: "read:invoices" },
    ]);
  });
});

describe("filterApiLogs (spec §23)", () => {
  const logs = [log({ id: "a", method: "GET", statusCode: 200 }), log({ id: "b", method: "PATCH", statusCode: 500, endpoint: "/api/frappe/customers" })];
  it("filters by method, status, endpoint", () => {
    expect(filterApiLogs(logs, { method: "PATCH" }).map((l) => l.id)).toEqual(["b"]);
    expect(filterApiLogs(logs, { status: "error" }).map((l) => l.id)).toEqual(["b"]);
    expect(filterApiLogs(logs, { status: "success" }).map((l) => l.id)).toEqual(["a"]);
    expect(filterApiLogs(logs, { endpoint: "customers" }).map((l) => l.id)).toEqual(["b"]);
  });
});

describe("apiKeyOverview", () => {
  it("counts active/revoked + requests/failed", () => {
    const now = new Date("2026-06-16");
    const o = apiKeyOverview([key({}), key({ isActive: false })], [log({ statusCode: 200 }), log({ statusCode: 500 })], now);
    expect(o).toEqual({ total: 2, active: 1, revoked: 1, requests: 2, failed: 1 });
  });
});
