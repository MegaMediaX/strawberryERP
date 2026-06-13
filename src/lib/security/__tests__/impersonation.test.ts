import { describe, expect, it } from "vitest";

import {
  canAccessSettings,
  canApproveDelete,
  canWriteResource,
  resolvePortalSession,
} from "@/lib/portal-security";

/**
 * Impersonation invariant — CLAUDE_HANDOFF.md §9 / §18:
 * Impersonation never expands the original actor's privileges, only a true
 * Super Admin can impersonate (lower-ranked roles only), and sensitive actions
 * (delete-queue resolution, settings writes) are blocked while impersonating.
 */

const roleRank: Record<string, number> = {
  "Sales Team User": 1,
  "Reseller Admin": 2,
  "Regional Director": 3,
  "Super Admin": 4,
};

function req(headers: Record<string, string>) {
  return new Request("https://portal.local/api/frappe/leads", { headers });
}

describe("Super Admin impersonating a lower role", () => {
  const session = resolvePortalSession(
    req({
      "x-platform-user-id": "USR-SUPER",
      "x-platform-impersonate-user-id": "USR-SALES-RAMI",
    }),
  );

  it("drops to the impersonated user's role (no privilege expansion)", () => {
    expect(session.user.role).toBe("Super Admin");
    expect(session.effectiveUser.role).toBe("Sales Team User");
    expect(session.impersonatedBy?.role).toBe("Super Admin");
  });

  it("cannot access settings while impersonating a non-admin", () => {
    expect(canAccessSettings(session)).toBe(false);
  });

  it("cannot resolve the delete queue while impersonating", () => {
    expect(canApproveDelete(session)).toBe(false);
  });

  it("cannot write settings / api keys while impersonating", () => {
    expect(canWriteResource(session, "settings/api/keys")).toBe(false);
  });
});

describe("Non-Super-Admin cannot impersonate", () => {
  const session = resolvePortalSession(
    req({
      "x-platform-user-id": "USR-REG-LB",
      "x-platform-impersonate-user-id": "USR-SUPER",
    }),
  );

  it("ignores the impersonation header and stays as itself", () => {
    expect(session.user.role).toBe("Regional Director");
    expect(session.effectiveUser.role).toBe("Regional Director");
    expect(session.impersonatedBy).toBeUndefined();
  });

  it("does NOT gain Super Admin powers via a spoofed impersonate header", () => {
    expect(canApproveDelete(session)).toBe(false);
    expect(canAccessSettings(session)).toBe(false);
  });
});

describe("Privilege never expands — effective rank <= actor rank for every combination", () => {
  const userIds = ["USR-SUPER", "USR-REG-LB", "USR-RESELLER-BDP", "USR-SALES-RAMI"];
  const targetIds = ["USR-SUPER", "USR-REG-LB", "USR-RESELLER-BDP", "USR-SALES-RAMI"];

  for (const actor of userIds) {
    for (const target of targetIds) {
      it(`${actor} impersonating ${target} cannot exceed actor rank`, () => {
        const session = resolvePortalSession(
          req({
            "x-platform-user-id": actor,
            "x-platform-impersonate-user-id": target,
          }),
        );
        expect(roleRank[session.effectiveUser.role]).toBeLessThanOrEqual(roleRank[session.user.role]);
      });
    }
  }
});

describe("True Super Admin (not impersonating) retains full powers", () => {
  const session = resolvePortalSession(req({ "x-platform-user-id": "USR-SUPER" }));

  it("can access settings and resolve the delete queue", () => {
    expect(session.impersonatedBy).toBeUndefined();
    expect(canAccessSettings(session)).toBe(true);
    expect(canApproveDelete(session)).toBe(true);
  });
});
