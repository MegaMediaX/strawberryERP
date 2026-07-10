import { describe, expect, it } from "vitest";

import { evaluateApiPermission } from "@/lib/security/permissions";

/**
 * SEC6-05 — evaluateApiPermission's matchesRecordScope must deny a
 * cross-tenant WRITE smuggled through the payload body, at the pure
 * evaluator layer (distinct from LC-01's route-level canAssignLeadTo check
 * on POST /api/frappe/leads — both are kept, testing different layers).
 */

function req(userId: string, headers: Record<string, string> = {}) {
  return new Request("https://portal.local/api/frappe/x", {
    headers: { "x-platform-user-id": userId, ...headers },
  });
}

describe("evaluateApiPermission — cross-tenant write payload denial", () => {
  it("denies a Reseller Admin writing a payload.reseller belonging to another reseller (403)", () => {
    const decision = evaluateApiPermission({
      request: req("USR-RESELLER-BDP"),
      resource: "customers",
      method: "PATCH",
      payload: { reseller: "Some Other Reseller", customer_name: "Hijack Attempt" },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(403);
  });

  it("allows a Reseller Admin writing their OWN reseller's record", () => {
    const decision = evaluateApiPermission({
      request: req("USR-RESELLER-BDP"),
      resource: "customers",
      method: "PATCH",
      payload: { reseller: "Beirut Digital Partners", customer_name: "Legit" },
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies a Sales Team User writing a payload.assignedUser belonging to another sales user (403)", () => {
    const decision = evaluateApiPermission({
      request: req("USR-SALES-MARVEN"),
      resource: "leads",
      method: "PATCH",
      payload: { assignedUser: "Elie Mouawad", companyName: "Hijack Attempt" },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(403);
  });

  it("allows a Sales Team User writing their OWN assignedUser", () => {
    const decision = evaluateApiPermission({
      request: req("USR-SALES-MARVEN"),
      resource: "leads",
      method: "PATCH",
      payload: { assignedUser: "Marven El Mouallem", companyName: "Legit" },
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies a Reseller Admin writing a payload.country outside their assigned countries (403, matchesRecordScope)", () => {
    // USR-RESELLER-BDP is scoped to Lebanon only (portal-security.ts); omitting
    // `reseller` from the payload passes canWrite's reseller check, isolating
    // this assertion to matchesRecordScope's country clause specifically.
    const decision = evaluateApiPermission({
      request: req("USR-RESELLER-BDP"),
      resource: "leads",
      method: "PATCH",
      payload: { country: "Cyprus", companyName: "Hijack Attempt" },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(403);
  });

  it("Regional Director writes are denied outright regardless of payload scope (canWrite hard-blocks the role)", () => {
    const decision = evaluateApiPermission({
      request: req("USR-REG-LB"),
      resource: "leads",
      method: "PATCH",
      payload: { country: "Lebanon", companyName: "Even in-scope is denied" },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(403);
  });

  it("Super Admin write with an arbitrary reseller/country payload is never scope-denied", () => {
    const decision = evaluateApiPermission({
      request: req("USR-SUPER"),
      resource: "customers",
      method: "PATCH",
      payload: { reseller: "Anything At All", country: "Cyprus" },
    });
    expect(decision.allowed).toBe(true);
  });
});
