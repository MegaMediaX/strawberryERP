import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * APP-9 positive-path guard. The safety argument for the fail-loud gate rests on
 * "a MAPPED resource always short-circuits via maybeRouteToFrappe BEFORE reaching
 * writeRequiresBackend()". This test locks that invariant: with Frappe CONFIGURED
 * and a resolving frappeRequest, a mapped admin write (lead reassign →
 * frappeMethodMap["leads"].patch) must return 200 source:"frappe" — NOT the
 * 501 the gate would produce. Guards against a future regression that reorders a
 * maybeRouteToFrappe call after the gate.
 *
 * countries/resellers/white-label are additionally quarantined behind
 * ADMIN_FRAPPE_WRITE_VERIFIED (see backend-router.ts) because their Frappe write
 * path is PR #22's still-HOLD-MERGE, not-yet-prod-verified code — see
 * admin-write-quarantine.test.ts for the (more important) proof that they do
 * NOT route to Frappe by default even when Frappe is configured. This file sets
 * the flag explicitly to keep proving the wiring itself is correct once a human
 * has verified the write path and opted in.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
  // A mapped write DOES route to Frappe; the transport resolves successfully.
  frappeRequest: vi.fn(async () => ({ name: "LEAD-2408", assigned_user: "Sana M." })),
}));

describe("admin mapped write (Frappe CONFIGURED) routes to Frappe, not the fail-loud gate — APP-9", () => {
  beforeEach(() => {
    // countries/resellers/white-label are quarantined by default — opt in for
    // this positive-path wiring proof (see file header).
    process.env.ADMIN_FRAPPE_WRITE_VERIFIED = "true";
  });
  afterEach(() => {
    delete process.env.ADMIN_FRAPPE_WRITE_VERIFIED;
  });

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

  it("country create routes to Frappe (countries.post → create_country)", async () => {
    const { POST } = await import("@/app/api/admin/countries/route");
    const req = new Request("https://portal.local/api/admin/countries", {
      method: "POST",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ name: "Kuwait", currency: "KWD", timezone: "UTC", invoicePrefix: "KW-INV", paymentMethods: ["Cash"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
  });

  it("reseller create routes to Frappe (resellers.post → create_reseller)", async () => {
    const { POST } = await import("@/app/api/admin/resellers/route");
    const req = new Request("https://portal.local/api/admin/resellers", {
      method: "POST",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ name: "New Reseller Co", countries: ["Lebanon"], defaultCurrency: "USD", defaultCommissionPercentage: 10, defaultCommissionTrigger: "Fully Paid", visibility: "Assigned Countries", isActive: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
  });

  it("white-label save routes to Frappe (white-label.patch → save_white_label)", async () => {
    const { PATCH } = await import("@/app/api/admin/white-label/route");
    const req = new Request("https://portal.local/api/admin/white-label", {
      method: "PATCH",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ platformName: "LebTech Partner Platform" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
  });

  it("currency create routes to Frappe (currencies.post → create_currency)", async () => {
    const { POST } = await import("@/app/api/admin/accounting/currencies/route");
    const req = new Request("https://portal.local/api/admin/accounting/currencies", {
      method: "POST",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ currencyCode: "AED", currencyName: "UAE Dirham", symbol: "AED", decimalPrecision: 2, isActive: true, manualExchangeRate: 0.27 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
  });

  it("payment method save routes to Frappe (payment-methods.patch → upsert_payment_method)", async () => {
    const { PATCH } = await import("@/app/api/admin/accounting/payment-methods/route");
    const req = new Request("https://portal.local/api/admin/accounting/payment-methods", {
      method: "PATCH",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ methodName: "Cash", isActive: false, displayOrder: 1 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
  });

  it("expense create routes to Frappe (expenses.post → create_expense)", async () => {
    const { POST } = await import("@/app/api/admin/accounting/expenses/route");
    const req = new Request("https://portal.local/api/admin/accounting/expenses", {
      method: "POST",
      headers: { "x-platform-user-id": "USR-SUPER", "content-type": "application/json" },
      body: JSON.stringify({ category: "Marketing", amount: 500, currency: "USD", date: "2026-07-05", notes: "Q3 ads" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
  });
});
