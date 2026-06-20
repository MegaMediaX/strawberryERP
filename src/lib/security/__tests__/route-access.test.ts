import { describe, expect, it } from "vitest";

import { authorizeUiRoute, findRouteAccessRule } from "@/lib/security/route-access";
import type { PortalRole, PortalSession, PortalUser } from "@/lib/portal-security";

/**
 * route-access gates EVERY portal page (review #11 — it had no direct tests).
 * Covers: login-required, role gating, requiresTrueSuperAdmin, impersonation
 * blocking, longest-pattern-wins, and the fail-closed unknown-route default.
 */

function user(role: PortalRole): PortalUser {
  return { id: "u", name: "U", email: "u@x.y", role, countries: [], active: true };
}

function session(realRole: PortalRole, opts: { effectiveRole?: PortalRole; impersonating?: boolean } = {}): PortalSession {
  return {
    user: user(realRole),
    effectiveUser: user(opts.effectiveRole ?? realRole),
    impersonatedBy: opts.impersonating ? user("Super Admin") : undefined,
    startedAt: "",
    source: "session-token",
    auditLabel: "",
    authenticated: true,
  };
}

describe("authorizeUiRoute", () => {
  it("allows a public route with no session", () => {
    expect(authorizeUiRoute("/login", null).allowed).toBe(true);
  });

  it("requires login on a protected route when unauthenticated", () => {
    const d = authorizeUiRoute("/leads", null);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("login_required");
  });

  it("fails CLOSED on an unknown route — even for a Super Admin", () => {
    const d = authorizeUiRoute("/totally-unknown-route", session("Super Admin"));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("access_denied");
  });

  it("denies a role outside allowedRoles (Sales user on /resellers)", () => {
    const d = authorizeUiRoute("/resellers", session("Sales Team User"));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("access_denied");
  });

  it("allows a role inside allowedRoles (Sales user on /leads)", () => {
    expect(authorizeUiRoute("/leads", session("Sales Team User")).allowed).toBe(true);
  });

  describe("requiresTrueSuperAdmin + impersonation", () => {
    it("allows a real, non-impersonating Super Admin on an API-key settings route", () => {
      expect(authorizeUiRoute("/settings/api", session("Super Admin")).allowed).toBe(true);
    });

    it("blocks an impersonating Super Admin on a blocked-when-impersonating route", () => {
      const d = authorizeUiRoute("/settings/api", session("Super Admin", { effectiveRole: "Reseller Admin", impersonating: true }));
      expect(d.allowed).toBe(false);
      if (!d.allowed) expect(d.reason).toBe("impersonation_blocked");
    });

    it("blocks an impersonating Super Admin on a true-super-admin route (audit logs)", () => {
      const d = authorizeUiRoute("/audit-logs", session("Super Admin", { effectiveRole: "Reseller Admin", impersonating: true }));
      expect(d.allowed).toBe(false);
      if (!d.allowed) expect(d.reason).toBe("impersonation_blocked");
    });

    it("denies a non-Super-Admin on a true-super-admin route", () => {
      const d = authorizeUiRoute("/audit-logs", session("Reseller Admin"));
      expect(d.allowed).toBe(false);
      if (!d.allowed) expect(d.reason).toBe("access_denied");
    });
  });
});

describe("findRouteAccessRule — longest pattern wins", () => {
  it("resolves /dashboard/widgets to its own rule, not /dashboard", () => {
    expect(findRouteAccessRule("/dashboard/widgets")?.pattern).toBe("/dashboard/widgets");
  });
  it("matches a nested path to its prefix rule", () => {
    expect(findRouteAccessRule("/leads/LEAD-2408")?.pattern).toBe("/leads");
  });
  it("returns undefined for an unmatched path (caller fails closed)", () => {
    expect(findRouteAccessRule("/nope")).toBeUndefined();
  });
});
