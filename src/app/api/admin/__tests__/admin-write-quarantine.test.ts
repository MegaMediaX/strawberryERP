import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADM-QUARANTINE. PR #22's countries/resellers/white-label Frappe write path
 * (create_country/update_country, create_reseller/update_reseller,
 * save_white_label) is HOLD-MERGE — see memory "prod-write-backend-gap" and
 * docs/production-readiness-plan.md: the live prod write path has NOT been
 * verified end-to-end against a real Frappe site. scripts/frappe-admin-write-smoke.mjs
 * (this lane) exists to do that verification but is env-gated + default-skip
 * and has not been run.
 *
 * backend-router.ts therefore quarantines writes (not reads) to these three
 * resources behind an explicit ADMIN_FRAPPE_WRITE_VERIFIED=true opt-in, on top
 * of (not instead of) isFrappeConfigured(). This file is the load-bearing
 * proof of that quarantine: even with Frappe fully configured and a
 * successfully-resolving frappeRequest mock (i.e. exactly the prod shape —
 * leads/customers ARE configured against Frappe in prod today per memory),
 * countries/resellers/white-label writes must still fall back to the
 * dev-store — NOT silently start persisting to Frappe — until a human sets
 * ADMIN_FRAPPE_WRITE_VERIFIED=true after confirming the staging smoke passes.
 *
 * This is the regression test for "merging this branch must not silently
 * activate the held write path": frappeRequest is a spy that would happily
 * succeed if called, so a passing dev-store assertion here can only mean the
 * quarantine gate — not a missing/failing mock — kept the write off Frappe.
 */
const frappeRequest = vi.fn(async () => ({ name: "SHOULD-NOT-BE-CALLED" }));
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
  frappeRequest: (...args: unknown[]) => frappeRequest(...(args as [])),
}));

function adminReq(method: "POST" | "PATCH", body: unknown, userId = "USR-SUPER") {
  return new Request("https://portal.local/api/admin/x", {
    method,
    headers: { "x-platform-user-id": userId, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectQuarantinedDevStore(res: Response, status: number) {
  expect(res.status).toBe(status);
  const body = (await res.json()) as { ok: boolean; source: string };
  expect(body.ok).toBe(true);
  expect(body.source).toBe("dev-store");
  expect(frappeRequest).not.toHaveBeenCalled();
}

beforeEach(() => {
  frappeRequest.mockClear();
  delete process.env.ADMIN_FRAPPE_WRITE_VERIFIED;
});

describe("ADM-QUARANTINE: countries/resellers/white-label writes stay dev-store with Frappe configured but ADMIN_FRAPPE_WRITE_VERIFIED unset (default)", () => {
  it("countries POST does not route to Frappe by default", async () => {
    const { POST } = await import("@/app/api/admin/countries/route");
    await expectQuarantinedDevStore(
      await POST(adminReq("POST", { name: "Kuwait", currency: "KWD", timezone: "UTC", invoicePrefix: "KW-INV", paymentMethods: ["Cash"] })),
      201,
    );
  });

  it("countries PATCH (toggle) does not route to Frappe by default", async () => {
    const { PATCH } = await import("@/app/api/admin/countries/route");
    const { upsertCountry } = await import("@/lib/dev-store");
    upsertCountry({ name: "Kuwait", currency: "KWD", timezone: "UTC", invoicePrefix: "KW-INV", active: true, paymentMethods: [] });
    await expectQuarantinedDevStore(await PATCH(adminReq("PATCH", { name: "Kuwait", active: false })), 200);
  });

  it("resellers POST does not route to Frappe by default", async () => {
    const { POST } = await import("@/app/api/admin/resellers/route");
    await expectQuarantinedDevStore(
      await POST(adminReq("POST", { name: "New Reseller Co", countries: ["Lebanon"], defaultCurrency: "USD", defaultCommissionPercentage: 10, defaultCommissionTrigger: "Fully Paid", visibility: "Assigned Countries", isActive: true })),
      201,
    );
  });

  it("resellers PATCH does not route to Frappe by default", async () => {
    const { PATCH } = await import("@/app/api/admin/resellers/route");
    const { upsertReseller } = await import("@/lib/dev-store");
    upsertReseller({ name: "New Reseller Co", countries: ["Lebanon"], defaultCurrency: "USD", defaultCommissionPercentage: 10, defaultCommissionTrigger: "Fully Paid", visibility: "Assigned Countries", isActive: true });
    await expectQuarantinedDevStore(await PATCH(adminReq("PATCH", { name: "New Reseller Co", active: false })), 200);
  });

  it("resellers/wizard POST does not route to Frappe by default", async () => {
    const { POST } = await import("@/app/api/admin/resellers/wizard/route");
    const { emptyWizardState } = await import("@/lib/admin/reseller-wizard");
    await expectQuarantinedDevStore(
      await POST(adminReq("POST", {
        ...emptyWizardState(),
        name: "Tripoli Tech Partners",
        email: "contact@tripolitech.example",
        countries: ["Lebanon"],
        adminFirstName: "Sara",
        adminLastName: "Haddad",
        adminEmail: "sara.haddad@tripolitech.example",
        adminPassword: "password123",
        currencies: ["USD"],
        defaultCurrency: "USD",
        paymentMethods: ["Cash"],
      })),
      201,
    );
  });

  it("white-label PATCH does not route to Frappe by default", async () => {
    const { PATCH } = await import("@/app/api/admin/white-label/route");
    await expectQuarantinedDevStore(await PATCH(adminReq("PATCH", { platformName: "LebTech Partner Platform" })), 200);
  });

  // Phase 3 admin-accounting writes join the same quarantine.
  it("currencies POST does not route to Frappe by default", async () => {
    const { POST } = await import("@/app/api/admin/accounting/currencies/route");
    await expectQuarantinedDevStore(
      await POST(adminReq("POST", { currencyCode: "AED", currencyName: "UAE Dirham", symbol: "AED", decimalPrecision: 2, isActive: true, manualExchangeRate: 0.27 })),
      201,
    );
  });

  it("payment-methods PATCH does not route to Frappe by default", async () => {
    const { PATCH } = await import("@/app/api/admin/accounting/payment-methods/route");
    await expectQuarantinedDevStore(await PATCH(adminReq("PATCH", { methodName: "Cash", isActive: false })), 200);
  });

  it("expenses POST does not route to Frappe by default", async () => {
    const { POST } = await import("@/app/api/admin/accounting/expenses/route");
    await expectQuarantinedDevStore(
      await POST(adminReq("POST", { category: "Marketing", amount: 500, currency: "USD", date: "2026-07-05", notes: "Q3 ads" })),
      201,
    );
  });

  it("resellers GET (list_resellers, pre-existing/already-verified) is unaffected by the write quarantine", async () => {
    // Sanity check that the quarantine is write-scoped, not resource-scoped:
    // GET was already mapped before PR #22 and must keep working exactly as
    // before once Frappe is configured, without needing the opt-in flag. This
    // route's GET always reads the dev-store directly (no Frappe routing), so
    // this simply proves no exception/regression was introduced by the
    // quarantine wiring around it.
    const { GET } = await import("@/app/api/admin/resellers/route");
    const res = GET(new Request("https://portal.local/api/admin/resellers", { headers: { "x-platform-user-id": "USR-SUPER" } }));
    expect(res.status).toBe(200);
  });
});

describe("ADM-QUARANTINE: opting in with ADMIN_FRAPPE_WRITE_VERIFIED=true restores Frappe routing", () => {
  beforeEach(() => {
    process.env.ADMIN_FRAPPE_WRITE_VERIFIED = "true";
  });
  afterEach(() => {
    delete process.env.ADMIN_FRAPPE_WRITE_VERIFIED;
  });

  it("countries POST routes to Frappe once verified", async () => {
    const { POST } = await import("@/app/api/admin/countries/route");
    const res = await POST(adminReq("POST", { name: "Oman", currency: "OMR", timezone: "UTC", invoicePrefix: "OM-INV", paymentMethods: ["Cash"] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
    expect(frappeRequest).toHaveBeenCalledTimes(1);
  });

  // Fresh currency code (BHD, not the AED created in the default-quarantine block
  // above) — the dev-store singleton persists across describes, and the route's
  // duplicate check runs before routing, so a reused code would 400 pre-proxy.
  it("currencies POST routes to Frappe once verified", async () => {
    const { POST } = await import("@/app/api/admin/accounting/currencies/route");
    const res = await POST(adminReq("POST", { currencyCode: "BHD", currencyName: "Bahraini Dinar", symbol: "BHD", decimalPrecision: 3, isActive: true, manualExchangeRate: 2.65 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("frappe");
    expect(frappeRequest).toHaveBeenCalledTimes(1);
  });
});
