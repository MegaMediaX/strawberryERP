import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/frappe/leads/route";
import { getCreatedLeads } from "@/lib/dev-store";

/**
 * Dev-store persistence CONTRACT for POST /api/frappe/leads (Frappe
 * unconfigured — the default in this test suite). This is a behavior-pinning
 * test: POST /api/frappe/leads is currently simulate-only. It builds a
 * mapped payload and returns 201, but never calls appendLead(), while GET
 * reads getCreatedLeads() (seeded from the fixed importedLeads fixture). A
 * lead accepted by POST is therefore NOT retrievable via a subsequent GET —
 * an honesty gap between "the API accepted your lead" and "the lead now
 * exists in the queryable dataset". If PR #22 (hold-merge) later wires real
 * persistence via appendLead, this test's assertions must flip along with it.
 */
function post(body: Record<string, unknown>) {
  return POST(
    new Request("https://portal.local/api/frappe/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
      body: JSON.stringify(body),
    }),
  );
}

function get(query = "?pageSize=200") {
  return GET(
    new Request(`https://portal.local/api/frappe/leads${query}`, {
      headers: { "x-platform-user-id": "USR-SUPER" },
    }),
  );
}

const UNIQUE_COMPANY = "Zzz-Persistence-Probe-Co-9f31";

describe("POST /api/frappe/leads — dev-store persistence contract (simulate-only)", () => {
  it("accepts the lead with 201 but does not append it to getCreatedLeads()", async () => {
    const before = getCreatedLeads().length;

    const res = await post({
      companyName: UNIQUE_COMPANY,
      country: "Lebanon",
      assignedUser: "Marven El Mouallem",
      phone: "+961 70 999 999",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("dev-store");

    expect(getCreatedLeads().length).toBe(before);
    expect(getCreatedLeads().some((l) => l.company === UNIQUE_COMPANY)).toBe(false);
  });

  it("a POSTed lead never shows up in a subsequent GET — total row count is unchanged", async () => {
    const totalBefore = await get().then((r) => r.json()).then((b) => (b as { total: number }).total);

    await post({
      companyName: UNIQUE_COMPANY,
      country: "Lebanon",
      assignedUser: "Marven El Mouallem",
      phone: "+961 70 888 888",
    });

    const afterRes = await get();
    const afterBody = (await afterRes.json()) as { total: number; data: Array<{ company?: string }> };
    expect(afterBody.total).toBe(totalBefore);
    expect(afterBody.data.some((row) => row.company === UNIQUE_COMPANY)).toBe(false);
  });
});
