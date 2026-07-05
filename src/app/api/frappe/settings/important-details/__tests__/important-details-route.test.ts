import { beforeEach, describe, expect, it } from "vitest";

import { GET, PATCH } from "@/app/api/frappe/settings/important-details/route";
import { getDevStore, setImportantDetails } from "@/lib/dev-store";

const BDP = "Beirut Digital Partners";

function req(method: string, userId: string, body?: unknown, query = "") {
  return new Request(`https://portal.local/api/frappe/settings/important-details${query}`, {
    method,
    headers: { "content-type": "application/json", "x-platform-user-id": userId },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const goodEntry = { id: "", title: "Guide", body: ["Be helpful"], applyTo: { scope: "all" } };

describe("/api/frappe/settings/important-details (§14)", () => {
  beforeEach(() => {
    // reset lock + entries between tests
    getDevStore().importantDetailLocks = {};
    setImportantDetails(BDP, []);
  });

  it("returns 501 BACKEND_NOT_CONFIGURED for a Reseller Admin write when Frappe is unconfigured, and does not persist", async () => {
    const patch = await PATCH(req("PATCH", "USR-RESELLER-BDP", { entries: [goodEntry] }));
    expect(patch.status).toBe(501);
    const body = await patch.json();
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");

    const get = await GET(req("GET", "USR-RESELLER-BDP"));
    const read = await get.json();
    expect(read.data.entries).toHaveLength(0);
  });

  it("rejects an invalid entry", async () => {
    const res = await PATCH(req("PATCH", "USR-RESELLER-BDP", { entries: [{ ...goodEntry, title: "" }] }));
    expect(res.status).toBe(400);
  });

  it("blocks a Reseller Admin when Super Admin has locked the section", async () => {
    getDevStore().importantDetailLocks = { [BDP]: true };
    const res = await PATCH(req("PATCH", "USR-RESELLER-BDP", { entries: [goodEntry] }));
    expect(res.status).toBe(403);
  });

  it("denies a Sales Team User from writing", async () => {
    const res = await PATCH(req("PATCH", "USR-SALES-RAMI", { entries: [goodEntry] }));
    expect(res.status).toBe(403);
  });
});
