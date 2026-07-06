import { describe, expect, it, vi } from "vitest";

/**
 * APP-9 positive-path guard. The safety argument for the fail-loud gate rests on
 * "a MAPPED resource always short-circuits via maybeRouteToFrappe BEFORE reaching
 * writeRequiresBackend()". This test locks that invariant: with Frappe CONFIGURED
 * and a resolving frappeRequest, a mapped admin write (lead reassign →
 * frappeMethodMap["leads"].patch) must return 200 source:"frappe" — NOT the
 * 501 the gate would produce. Guards against a future regression that reorders a
 * maybeRouteToFrappe call after the gate.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
  // A mapped write DOES route to Frappe; the transport resolves successfully.
  frappeRequest: vi.fn(async () => ({ name: "LEAD-2408", assigned_user: "Sana M." })),
}));

describe("admin mapped write (Frappe CONFIGURED) routes to Frappe, not the fail-loud gate — APP-9", () => {
  it("lead reassign returns 200 source:frappe (short-circuits before writeRequiresBackend)", async () => {
    const { PATCH } = await import("@/app/api/admin/leads/route");

    const req = new Request("https://portal.local/api/admin/leads", {
      method: "PATCH",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ leadId: "LEAD-2408", action: "reassign", assignedTo: "Sana M." }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
  });
});
