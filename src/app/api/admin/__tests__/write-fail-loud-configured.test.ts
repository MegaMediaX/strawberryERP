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
  // Uses invoicing settings — a still-unmapped admin write that calls
  // writeRequiresBackend() directly (no frappeMethodMap entry). currencies /
  // payment-methods / expenses gained a Frappe method in Phase 3, so they are no
  // longer valid "unmapped" examples (they now dev-store-fallback / route to
  // Frappe); their behavior is covered in admin-write-quarantine +
  // write-route-mapped-configured + write-gate-coverage.
  it("invoicing settings save returns 501 BACKEND_NOT_CONFIGURED, not a dev-store success", async () => {
    const { PATCH } = await import("@/app/api/admin/accounting/invoicing/route");

    const req = new Request("https://portal.local/api/admin/accounting/invoicing", {
      method: "PATCH",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ mode: "Country Prefix", prefix: "LB", nextSequence: 42, pdfTemplate: "classic", qrCode: true, emailSend: true }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(501);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
  });
});
