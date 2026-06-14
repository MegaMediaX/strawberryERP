import { describe, expect, it } from "vitest";

import { resolvePortalSession } from "@/lib/portal-security";
import { leadsScopeForFrappe } from "@/lib/security/leads-scope";

/**
 * §4/§9: the scope forwarded to Frappe `list_leads` must isolate data per role,
 * matching the dev-store filterByPermission behavior.
 */

function scopeFor(userId: string) {
  const session = resolvePortalSession(new Request("https://x/api/frappe/leads", { headers: { "x-platform-user-id": userId } }));
  return leadsScopeForFrappe(session);
}

describe("leadsScopeForFrappe", () => {
  it("Super Admin gets no scope (sees all)", () => {
    expect(scopeFor("USR-SUPER")).toEqual({});
  });

  it("Regional Director scopes to their assigned countries (multi-country)", () => {
    // USR-REG-LB covers Lebanon + Jordan
    const scope = scopeFor("USR-REG-LB");
    expect(scope.countries).toBe("Lebanon,Jordan");
    expect(scope.assigned_user).toBeUndefined();
    expect(scope.reseller).toBeUndefined();
  });

  it("Reseller Admin scopes to their reseller", () => {
    const scope = scopeFor("USR-RESELLER-BDP");
    expect(scope.reseller).toBe("Beirut Digital Partners");
    expect(scope.country).toBe("Lebanon"); // single country -> also constrained
    expect(scope.assigned_user).toBeUndefined();
  });

  it("Sales Team User scopes to their own assigned leads", () => {
    const scope = scopeFor("USR-SALES-RAMI");
    expect(scope.assigned_user).toBe("Rami K.");
    expect(scope.countries).toBeUndefined();
  });
});
