import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADM-W10: with Frappe CONFIGURED, real guard failures (blocked country,
 * unknown reseller) must short-circuit BEFORE maybeRouteToFrappe is ever
 * invoked. write-gate-coverage.test.ts already proves this ordering with
 * Frappe UNCONFIGURED (guard fires before the 501 gate); this file proves the
 * same ordering holds once Frappe IS configured and frappeRequest is a live
 * spy — a regression that moved the guard after the routing call would leak
 * an invalid write attempt (and its network mock) to Frappe.
 */
const frappeRequest = vi.fn(async (_path: string, _init?: { method: string; body?: unknown }) => ({ name: "OK" }));
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
  frappeRequest: (path: string, init?: { method: string; body?: unknown }) => frappeRequest(path, init),
}));

function adminReq(method: "POST" | "PATCH", body: unknown, userId = "USR-SUPER") {
  return new Request("https://portal.local/api/admin/x", {
    method,
    headers: { "x-platform-user-id": userId, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  frappeRequest.mockClear();
});

describe("ADM-W10: guard-before-route ordering (Frappe configured)", () => {
  it("countries POST 400s a blocked country (Israel) before ever calling frappeRequest", async () => {
    const { POST } = await import("@/app/api/admin/countries/route");
    const res = await POST(adminReq("POST", { name: "Israel", currency: "USD", timezone: "UTC", invoicePrefix: "IL-INV" }));
    expect(res.status).toBe(400);
    expect(frappeRequest).not.toHaveBeenCalled();
  });

  it("resellers PATCH 404s an unknown reseller before ever calling frappeRequest", async () => {
    const { PATCH } = await import("@/app/api/admin/resellers/route");
    const res = await PATCH(adminReq("PATCH", { name: "No Such Reseller", active: false }));
    expect(res.status).toBe(404);
    expect(frappeRequest).not.toHaveBeenCalled();
  });

  it("countries PATCH 404s an unknown country before ever calling frappeRequest", async () => {
    const { PATCH } = await import("@/app/api/admin/countries/route");
    const res = await PATCH(adminReq("PATCH", { name: "Atlantis", active: false }));
    expect(res.status).toBe(404);
    expect(frappeRequest).not.toHaveBeenCalled();
  });

  it("resellers POST 400s an invalid reseller form before ever calling frappeRequest", async () => {
    const { POST } = await import("@/app/api/admin/resellers/route");
    const res = await POST(adminReq("POST", { name: "", countries: [], defaultCurrency: "", defaultCommissionPercentage: -1 }));
    expect(res.status).toBe(400);
    expect(frappeRequest).not.toHaveBeenCalled();
  });

  it("white-label PATCH 403s a non-Super-Admin before ever calling frappeRequest", async () => {
    const { PATCH } = await import("@/app/api/admin/white-label/route");
    const res = await PATCH(adminReq("PATCH", { platformName: "Sneaky" }, "USR-SALES-MARVEN"));
    expect(res.status).toBe(403);
    expect(frappeRequest).not.toHaveBeenCalled();
  });
});
