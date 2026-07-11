import { describe, expect, it } from "vitest";

import { evaluateApiPermission } from "@/lib/security/permissions";

/**
 * SEC6-06 — portal-session hardening at the evaluateApiPermission layer:
 *  1. An expired `x-platform-session-expires-at` yields 401, even for an
 *     otherwise-valid, fully-privileged Super Admin session.
 *  2. A sensitive action (e.g. API key creation) is blocked while the caller
 *     is impersonating another user, regardless of the impersonated role.
 */

function req(headers: Record<string, string>) {
  return new Request("https://portal.local/api/frappe/x", { headers });
}

describe("evaluateApiPermission — expired session", () => {
  it("denies with 401 when x-platform-session-expires-at is in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const decision = evaluateApiPermission({
      request: req({ "x-platform-user-id": "USR-SUPER", "x-platform-session-expires-at": past }),
      resource: "leads",
      method: "GET",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(401);
  });

  it("allows when expiresAt is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const decision = evaluateApiPermission({
      request: req({ "x-platform-user-id": "USR-SUPER", "x-platform-session-expires-at": future }),
      resource: "leads",
      method: "GET",
    });
    expect(decision.allowed).toBe(true);
  });

  it("allows when no expiresAt header is present at all", () => {
    const decision = evaluateApiPermission({
      request: req({ "x-platform-user-id": "USR-SUPER" }),
      resource: "leads",
      method: "GET",
    });
    expect(decision.allowed).toBe(true);
  });
});

describe("evaluateApiPermission — sensitive actions blocked while impersonating", () => {
  it("denies a Super Admin creating an API key while impersonating a lower role (403)", () => {
    const decision = evaluateApiPermission({
      request: req({
        "x-platform-user-id": "USR-SUPER",
        "x-platform-impersonate-user-id": "USR-SALES-MARVEN",
      }),
      resource: "settings/api/keys",
      method: "POST",
      payload: { keyName: "Test" },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(403);
    expect(decision.reason).toMatch(/impersonating/i);
  });

  it("the same sensitive action is allowed for the same Super Admin NOT impersonating", () => {
    const decision = evaluateApiPermission({
      request: req({ "x-platform-user-id": "USR-SUPER" }),
      resource: "settings/api/keys",
      method: "POST",
      payload: { keyName: "Test" },
    });
    expect(decision.allowed).toBe(true);
  });

  it("a non-sensitive action is unaffected by impersonation", () => {
    const decision = evaluateApiPermission({
      request: req({
        "x-platform-user-id": "USR-SUPER",
        "x-platform-impersonate-user-id": "USR-SALES-MARVEN",
      }),
      resource: "leads",
      method: "GET",
    });
    expect(decision.allowed).toBe(true);
  });
});
