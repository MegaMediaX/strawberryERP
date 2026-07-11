import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/leads/route";

/**
 * §9 route-level proof: canAssignLeadTo (src/lib/security/assignable-users.ts)
 * is actually wired into POST /api/frappe/leads at route.ts:107-109, not just
 * unit-tested in isolation.
 *
 * A Sales Team User assigning to anyone but themselves is already rejected
 * earlier, at 403, by the generic role-scope guard (matchesRecordScope in
 * src/lib/security/permissions.ts, covered by the Security lane) — that layer
 * never reaches canAssignLeadTo. To prove THIS route's own guard fires (400,
 * not the generic 403), we use a Reseller Admin: matchesRecordScope only
 * checks the `reseller` field for that role (absent on a lead payload), so a
 * Reseller Admin request reaches canAssignLeadTo — which then enforces the
 * authority-scope rule (assignee must rank below the actor AND share their
 * reseller/country scope) that matchesRecordScope does not cover.
 */
function post(body: Record<string, unknown>, userId: string) {
  return POST(
    new Request("https://portal.local/api/frappe/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-platform-user-id": userId },
      body: JSON.stringify(body),
    }),
  );
}

const VALID_BASE = {
  companyName: "Cedar Cloud LLC",
  country: "Lebanon",
  phone: "+961 70 123 456",
};

describe("POST /api/frappe/leads — assignment authority (§9, route.ts canAssignLeadTo wiring)", () => {
  it("400s when a Reseller Admin tries to assign a lead to a user outside their authority (a Regional Director outranks/isn't their subordinate)", async () => {
    const res = await post({ ...VALID_BASE, assignedUser: "Maya Regional" }, "USR-RESELLER-BDP");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("You can only assign this lead to a user you manage.");
  });

  it("allows a Reseller Admin to assign a lead to their own sales-team subordinate", async () => {
    const res = await post({ ...VALID_BASE, assignedUser: "Marven El Mouallem" }, "USR-RESELLER-BDP");
    expect(res.status).toBe(201);
  });

  it("allows a Reseller Admin to assign a lead to themselves", async () => {
    const res = await post({ ...VALID_BASE, assignedUser: "Beirut Reseller Admin" }, "USR-RESELLER-BDP");
    expect(res.status).toBe(201);
  });

  it("allows a Super Admin to assign a lead to any known user", async () => {
    const res = await post({ ...VALID_BASE, assignedUser: "Elie Mouawad" }, "USR-SUPER");
    expect(res.status).toBe(201);
  });

  it("a Sales Team User assigning to anyone but themselves is rejected before reaching this route's guard (403, generic role-scope layer)", async () => {
    // Documents the layering: the crafted-request bypass IS blocked end-to-end,
    // just by an earlier, more general guard for this particular role.
    const res = await post({ ...VALID_BASE, assignedUser: "Elie Mouawad" }, "USR-SALES-MARVEN");
    expect(res.status).toBe(403);
  });
});
