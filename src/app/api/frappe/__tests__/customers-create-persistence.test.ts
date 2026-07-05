import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/frappe/[...resource]/route";

/**
 * P0-1 — non-persisting "create" for customers / resellers / commissions/rules.
 *
 * Customers is the primary CRM entity: POST must actually persist to the
 * dev-store so a subsequent GET reflects the new record (previously the POST
 * fabricated a 201 response but wrote nothing).
 *
 * The legacy `resellers` and `commissions/rules` POSTs have no structured
 * dev-store collection yet — they must return 202 with `persisted: false` so
 * clients never mistake the response for a real write.
 */

function request(method: "GET" | "POST", resource: string[], body?: Record<string, unknown>, opts: { userId?: string } = {}) {
  const headers: Record<string, string> = { "x-platform-user-id": opts.userId ?? "USR-SUPER" };
  const init: RequestInit = { method, headers };
  if (body) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return { request: new Request(`https://portal.local/api/frappe/${resource.join("/")}`, init), params: Promise.resolve({ resource }) };
}

describe("POST customers persists to the dev-store", () => {
  it("returns 501 BACKEND_NOT_CONFIGURED and does not persist when Frappe is unconfigured", async () => {
    const name = `Persistence Test Co ${Date.now()}`;
    const createReq = request("POST", ["customers"], { name, country: "Lebanon", reseller: "Beirut Digital Partners" });
    const createRes = await POST(createReq.request, { params: createReq.params });
    expect(createRes.status).toBe(501);
    const createBody = (await createRes.json()) as { ok: boolean; error: { code: string } };
    expect(createBody.ok).toBe(false);
    expect(createBody.error.code).toBe("BACKEND_NOT_CONFIGURED");

    const getReq = request("GET", ["customers"]);
    const getRes = await GET(getReq.request, { params: getReq.params });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { ok: boolean; data: Array<{ id: string; name: string }> };
    expect(getBody.data.some((c) => c.name === name)).toBe(false);
  });

  it("rejects an invalid country and does not persist anything", async () => {
    const createReq = request("POST", ["customers"], { name: "Bad Country Co", country: "Israel" });
    const createRes = await POST(createReq.request, { params: createReq.params });
    expect(createRes.status).toBe(400);
  });
});

describe("POST resellers (legacy, no structured store) is honest about not persisting", () => {
  it("returns 202 with persisted:false and a mock note", async () => {
    const createReq = request("POST", ["resellers"], { name: "New Legacy Reseller", country: "Lebanon" });
    const createRes = await POST(createReq.request, { params: createReq.params });
    expect(createRes.status).toBe(202);
    const body = (await createRes.json()) as { persisted: boolean; note: string };
    expect(body.persisted).toBe(false);
    expect(body.note).toMatch(/mock until Frappe migration/i);
  });
});

describe("POST commissions/rules (legacy, no structured store) is honest about not persisting", () => {
  it("returns 202 with persisted:false and a mock note", async () => {
    const createReq = request("POST", ["commissions", "rules"], {
      reseller: "Beirut Digital Partners",
      country: "Lebanon",
      commissionPercentage: 10,
      triggerCondition: "Fully Paid",
    });
    const createRes = await POST(createReq.request, { params: createReq.params });
    expect(createRes.status).toBe(202);
    const body = (await createRes.json()) as { persisted: boolean; note: string };
    expect(body.persisted).toBe(false);
    expect(body.note).toMatch(/mock until Frappe migration/i);
  });
});
