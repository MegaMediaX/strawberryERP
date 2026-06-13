import { describe, expect, it } from "vitest";

import { evaluateApiPermission } from "@/lib/security/permissions";

/**
 * API-key scoping at the request level — CLAUDE_HANDOFF.md §9 / §18.
 * Exercises the real evaluateApiPermission against the seeded dev-store keys:
 *   APIK-001     ltp_live_9f2a  scopes read:leads/invoices/reports, read-only, active
 *   APIK-EXPIRED ltp_expired    expired 2025-12-31
 *   APIK-REVOKED ltp_revoked    isActive=false, revoked
 */

function evaluate(opts: {
  resource: string;
  method: "GET" | "POST" | "PATCH";
  keyPrefix?: string;
  payload?: Record<string, unknown>;
}) {
  const headers: Record<string, string> = { "x-platform-user-id": "USR-SUPER" };
  if (opts.keyPrefix) headers["x-api-key-prefix"] = opts.keyPrefix;
  return evaluateApiPermission({
    request: new Request("https://portal.local/api/frappe/x", { headers }),
    resource: opts.resource,
    method: opts.method,
    payload: opts.payload,
  });
}

describe("§9 — API-key scope enforcement", () => {
  it("allows a GET within the key's scopes", () => {
    expect(evaluate({ resource: "leads", method: "GET", keyPrefix: "ltp_live_9f2a" }).allowed).toBe(true);
    expect(evaluate({ resource: "invoices", method: "GET", keyPrefix: "ltp_live_9f2a" }).allowed).toBe(true);
  });

  it("denies a GET outside the key's scopes (no read:customers)", () => {
    const d = evaluate({ resource: "customers", method: "GET", keyPrefix: "ltp_live_9f2a" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(403);
  });

  it("denies writes for a read-only key", () => {
    const d = evaluate({ resource: "leads", method: "POST", keyPrefix: "ltp_live_9f2a" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(403);
  });
});

describe("§9 — API keys can never reach administrative routes", () => {
  const adminRoutes = ["settings", "settings/api/keys", "settings/delete-queue", "delete-queue/resolve"];
  for (const resource of adminRoutes) {
    it(`denies a key on ${resource}`, () => {
      const d = evaluate({ resource, method: "GET", keyPrefix: "ltp_live_9f2a" });
      expect(d.allowed).toBe(false);
      expect(d.status).toBe(403);
    });
  }
});

describe("§9 — invalid keys are rejected", () => {
  it("rejects an expired key", () => {
    const d = evaluate({ resource: "leads", method: "GET", keyPrefix: "ltp_expired" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(401);
  });

  it("rejects a revoked key", () => {
    const d = evaluate({ resource: "leads", method: "GET", keyPrefix: "ltp_revoked" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(401);
  });

  it("rejects an unknown key header", () => {
    const d = evaluate({ resource: "leads", method: "GET", keyPrefix: "ltp_does_not_exist" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(401);
  });
});

describe("§9 — no key header falls through to session auth (keys are opt-in)", () => {
  it("allows the Super Admin session when no key header is present", () => {
    expect(evaluate({ resource: "leads", method: "GET" }).allowed).toBe(true);
  });
});
