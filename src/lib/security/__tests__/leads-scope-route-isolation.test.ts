import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/frappe/leads/route";

/**
 * SEC6-04 — end-to-end route-level isolation for GET /api/frappe/leads
 * (dev-store path, Frappe unconfigured). `leadsScopeForFrappe` and
 * `filterByPermission` are already unit-tested individually; this proves the
 * actual route WIRES them so a Sales Team User session receives only their
 * own assigned leads, not the full table.
 *
 * Fixture note: sample-data leads seeds exactly one lead assigned to
 * "Marven El Mouallem" (LEAD-2408); every dev-store import fixture lead is
 * assigned to "Elie Mouawad" instead. The expected set below is asserted
 * non-empty so this test cannot pass vacuously.
 */

function getReq(userId: string) {
  return new Request("https://portal.local/api/frappe/leads", {
    headers: { "x-platform-user-id": userId },
  });
}

describe("GET /api/frappe/leads — Sales Team User dev-store isolation", () => {
  it("a Sales Team User sees ONLY their own assigned leads", async () => {
    const res = await GET(getReq("USR-SALES-MARVEN"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; assignedTo: string }> };

    expect(body.data.length).toBeGreaterThan(0);
    for (const lead of body.data) {
      expect(lead.assignedTo).toBe("Marven El Mouallem");
    }
    expect(body.data.some((lead) => lead.id === "LEAD-2408")).toBe(true);
  });

  it("a different Sales Team User sees a disjoint set (their own leads, not Marven's)", async () => {
    const res = await GET(getReq("USR-SALES-ELIE"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; assignedTo: string }> };

    expect(body.data.length).toBeGreaterThan(0);
    for (const lead of body.data) {
      expect(lead.assignedTo).toBe("Elie Mouawad");
    }
    expect(body.data.some((lead) => lead.id === "LEAD-2408")).toBe(false);
  });

  it("Super Admin sees leads from more than one assignee (unscoped)", async () => {
    const res = await GET(getReq("USR-SUPER"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ assignedTo: string }> };
    const distinctAssignees = new Set(body.data.map((lead) => lead.assignedTo));
    expect(distinctAssignees.size).toBeGreaterThan(1);
  });
});
