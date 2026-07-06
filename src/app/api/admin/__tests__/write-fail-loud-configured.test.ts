import { describe, expect, it, vi } from "vitest";

/**
 * APP-9 regression. The `write-fail-loud.test.ts` sibling proves the gate 501s
 * when Frappe is UNCONFIGURED. This file proves the harder, previously-broken
 * case: with Frappe CONFIGURED but the resource unmapped (no Frappe method),
 * an admin write must STILL fail loud with 501 instead of silently persisting a
 * fake success to the in-memory dev-store.
 *
 * isFrappeConfigured reads env at module-load, so we mock it to "configured".
 * frappeRequest is stubbed to throw — an unmapped write must never reach it.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
  frappeRequest: vi.fn(async () => {
    throw new Error("frappeRequest must not be called for an unmapped write");
  }),
}));

describe("admin write fail-loud gate (Frappe CONFIGURED, unmapped resource) — APP-9", () => {
  it("currency create returns 501 BACKEND_NOT_CONFIGURED, not a dev-store success", async () => {
    const { POST } = await import("@/app/api/admin/accounting/currencies/route");

    const req = new Request("https://portal.local/api/admin/accounting/currencies", {
      method: "POST",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({
        currencyCode: "ZZZ",
        currencyName: "Test Currency",
        symbol: "Z",
        decimalPrecision: 2,
        isActive: true,
        assignedCountries: [],
        assignedResellers: [],
        manualExchangeRate: 1,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(501);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
  });
});
