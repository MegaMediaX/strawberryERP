import { describe, expect, it } from "vitest";

import { leadsScopeForFrappe } from "@/lib/security/leads-scope";
import { mapLeadToFrappe } from "@/app/api/frappe/leads/route";
import type { PortalSession, PortalUser } from "@/lib/portal-security";

/**
 * Regression guard for the `assigned_user` Link→Data fix (see
 * docs/superpowers/specs/2026-07-07-partner-user-provisioning-design.md).
 *
 * Platform users are portal identities, NOT Frappe `User` records, so
 * `Partner Lead.assigned_user` is a plain `Data` field holding the display
 * NAME. Both sides of the Frappe boundary must agree on that same plain string:
 *   - GET scope  (leadsScopeForFrappe) filters by the caller's display name.
 *   - POST/PATCH write (mapLeadToFrappe) sends the display name.
 * If either side ever switched to an id/email (or the doctype went back to
 * Link→User), assignment + Sales-user lead scoping would silently break again.
 */
function sessionFor(overrides: Partial<PortalUser>): PortalSession {
  const effectiveUser: PortalUser = {
    id: "USR-SALES-RAMI",
    name: "Rami K.",
    email: "rami@beirutdigital.example",
    role: "Sales Team User",
    countries: ["Lebanon"],
    reseller: "Beirut Digital Partners",
    active: true,
    ...overrides,
  };
  return {
    user: effectiveUser,
    effectiveUser,
    startedAt: "1970-01-01T00:00:00.000Z",
    source: "session-token",
    auditLabel: `${effectiveUser.name} as ${effectiveUser.role}`,
  } as PortalSession;
}

describe("assigned_user is a plain display-name contract on both sides of Frappe", () => {
  it("Sales Team User GET scope filters by the display name (not an id/email)", () => {
    const scope = leadsScopeForFrappe(sessionFor({ role: "Sales Team User", name: "Rami K." }));
    expect(scope).toEqual({ assigned_user: "Rami K." });
  });

  it("the POST/PATCH write sends the same display name for assigned_user", () => {
    const out = mapLeadToFrappe({ assignedUser: "Rami K." });
    expect(out).toEqual({ assigned_user: "Rami K." });
  });

  it("GET-scope filter and write agree on the identical assigned_user value", () => {
    const name = "Rami K.";
    const scope = leadsScopeForFrappe(sessionFor({ role: "Sales Team User", name }));
    const write = mapLeadToFrappe({ assignedUser: name });
    expect(scope.assigned_user).toBe(write.assigned_user);
  });

  it("Super Admin is unscoped (no assigned_user filter)", () => {
    const scope = leadsScopeForFrappe(sessionFor({ role: "Super Admin", name: "Super Admin" }));
    expect("assigned_user" in scope).toBe(false);
  });
});
