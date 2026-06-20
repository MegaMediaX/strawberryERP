import { describe, expect, it } from "vitest";

import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session-token";
import { evaluateApiPermission } from "@/lib/security/permissions";
import { resolvePortalSession } from "@/lib/portal-security";

/**
 * §17/§18 regression: the /api/frappe boundary must FAIL CLOSED in production.
 * An unauthenticated request (no signed cookie, no API key) must NOT resolve to
 * a privileged user — this was a real bypass found via live testing.
 */

function evaluate(headers: Record<string, string>) {
  return evaluateApiPermission({
    request: new Request("https://portal.local/api/frappe/leads", { headers }),
    resource: "leads",
    method: "GET",
  });
}

function withProductionEnv<T>(fn: () => T): T {
  const original = process.env.NODE_ENV;
  try {
    // @ts-expect-error override for the test
    process.env.NODE_ENV = "production";
    return fn();
  } finally {
    // @ts-expect-error restore
    process.env.NODE_ENV = original;
  }
}

describe("production /api/frappe auth", () => {
  it("DENIES an unauthenticated request in production (401)", () => {
    withProductionEnv(() => {
      const d = evaluate({});
      expect(d.allowed).toBe(false);
      expect(d.status).toBe(401);
    });
  });

  it("IGNORES a spoofed x-platform-user-id header in production", () => {
    withProductionEnv(() => {
      const d = evaluate({ "x-platform-user-id": "USR-SUPER" });
      expect(d.allowed).toBe(false);
      expect(d.status).toBe(401);
    });
  });

  it("ALLOWS a request with a valid signed session cookie in production", () => {
    withProductionEnv(() => {
      const token = createSessionToken("USR-SUPER");
      const d = evaluate({ cookie: `${SESSION_COOKIE}=${token}` });
      expect(d.allowed).toBe(true);
      expect(d.session.user.role).toBe("Super Admin");
    });
  });

  it("still allows dev-header identity outside production (developer convenience)", () => {
    const d = evaluate({ "x-platform-user-id": "USR-SUPER" });
    expect(d.allowed).toBe(true);
  });
});

describe("resolvePortalSession — admin-route fail-closed (regression for the /api/admin escalation)", () => {
  it("unauthenticated production resolves to a NON-Super-Admin, unauthenticated user", () => {
    withProductionEnv(() => {
      const s = resolvePortalSession(new Request("https://portal.local/api/admin/resellers"));
      expect(s.authenticated).toBe(false);
      expect(s.user.role).not.toBe("Super Admin"); // the bug: used to default to Super Admin
      expect(s.user.id).toBe("ANON");
    });
  });

  it("ignores a spoofed x-platform-user-id in production (stays anonymous)", () => {
    withProductionEnv(() => {
      const s = resolvePortalSession(new Request("https://portal.local/api/admin/resellers", { headers: { "x-platform-user-id": "USR-SUPER" } }));
      expect(s.user.role).not.toBe("Super Admin");
    });
  });

  it("a valid signed cookie still resolves the real Super Admin in production", () => {
    withProductionEnv(() => {
      const token = createSessionToken("USR-SUPER");
      const s = resolvePortalSession(new Request("https://portal.local/api/admin/resellers", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }));
      expect(s.authenticated).toBe(true);
      expect(s.user.role).toBe("Super Admin");
    });
  });
});
