import { describe, expect, it } from "vitest";

import { resolvePortalSession } from "@/lib/portal-security";
import { callsScopeForFrappe } from "@/lib/security/calls-scope";

/**
 * The scope forwarded to Frappe `list_calls` must isolate data per role,
 * mirroring scopeCallRecords (src/lib/telephony/call-kpis.ts) and
 * leadsScopeForFrappe (leads-scope.ts / leads-scope.test.ts).
 */

function scopeFor(userId: string) {
  const session = resolvePortalSession(new Request("https://x/api/reports/call-kpis", { headers: { "x-platform-user-id": userId } }));
  return callsScopeForFrappe(session);
}

describe("callsScopeForFrappe", () => {
  it("Super Admin gets no scope (sees all)", () => {
    expect(scopeFor("USR-SUPER")).toEqual({});
  });

  it("Regional Director scopes to their assigned countries (multi-country)", () => {
    const scope = scopeFor("USR-REG-LB");
    expect(scope.countries).toBe("Lebanon,Jordan");
    expect(scope.agent).toBeUndefined();
    expect(scope.reseller).toBeUndefined();
  });

  it("Reseller Admin scopes to their reseller", () => {
    const scope = scopeFor("USR-RESELLER-BDP");
    expect(scope.reseller).toBe("Beirut Digital Partners");
    expect(scope.agent).toBeUndefined();
  });

  it("Sales Team User scopes to their own agent identity", () => {
    const scope = scopeFor("USR-SALES-MARVEN");
    expect(scope.agent).toBe("Marven El Mouallem");
    expect(scope.countries).toBeUndefined();
  });
});
