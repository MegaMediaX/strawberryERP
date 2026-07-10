import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADM-W6 (NEVER-CUT): Frappe is configured but the write itself throws
 * (network blip, backend 500, timeout). This is the prod "writes fail loud"
 * guard — the admin write surface must surface 502 FRAPPE_CONNECTION_ERROR and
 * must NEVER fall through to a dev-store fake-success. This is exactly the
 * prod-write-backend-gap masquerade scenario from memory: a real production
 * write failure must never look identical to a successful persist.
 *
 * The backend-router 502-mapping mechanism itself (maybeRouteToFrappe's
 * try/catch) is unit-tested once in the frappe lane's
 * backend-router-routing.test.ts (TC-03); this file only proves the ADMIN
 * routes are wired to that mechanism and never bypass it with their own
 * dev-store fallback once Frappe is configured.
 *
 * countries/resellers/white-label are quarantined behind
 * ADMIN_FRAPPE_WRITE_VERIFIED even when Frappe is configured (PR #22's write
 * path is still HOLD-MERGE/unverified — see backend-router.ts and
 * admin-write-quarantine.test.ts). This file needs the write to actually
 * attempt routing to Frappe (so it can throw), so it opts in explicitly.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
  frappeRequest: vi.fn(async () => {
    throw new Error("Frappe request failed: 500 Internal Server Error");
  }),
}));

function adminReq(method: "POST" | "PATCH", body: unknown, userId = "USR-SUPER") {
  return new Request("https://portal.local/api/admin/x", {
    method,
    headers: { "x-platform-user-id": userId, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectConnectionError(res: Response) {
  expect(res.status).toBe(502);
  const body = (await res.json()) as { ok: boolean; error: { code: string } };
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("FRAPPE_CONNECTION_ERROR");
  // The precise regression this guards: a thrown Frappe write must NEVER be
  // reported as a successful dev-store persist.
  expect(body).not.toMatchObject({ ok: true, source: "dev-store" });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Quarantined by default (see backend-router.ts) — opt in so these writes
  // actually attempt to route to Frappe and can throw.
  process.env.ADMIN_FRAPPE_WRITE_VERIFIED = "true";
});

afterEach(() => {
  delete process.env.ADMIN_FRAPPE_WRITE_VERIFIED;
});

describe("ADM-W6: admin writes surface 502 on a Frappe write failure (never a dev-store fake-success)", () => {
  it("countries POST", async () => {
    const { POST } = await import("@/app/api/admin/countries/route");
    await expectConnectionError(await POST(adminReq("POST", { name: "Malta", currency: "EUR", timezone: "UTC", invoicePrefix: "MT-INV" })));
  });

  it("countries PATCH (toggle)", async () => {
    const { PATCH } = await import("@/app/api/admin/countries/route");
    const { upsertCountry } = await import("@/lib/dev-store");
    upsertCountry({ name: "Malta", currency: "EUR", timezone: "UTC", invoicePrefix: "MT-INV", active: true, paymentMethods: [] });
    await expectConnectionError(await PATCH(adminReq("PATCH", { name: "Malta", active: false })));
  });

  it("resellers POST", async () => {
    const { POST } = await import("@/app/api/admin/resellers/route");
    await expectConnectionError(await POST(adminReq("POST", { name: "Failing Reseller Co", countries: ["Lebanon"], defaultCurrency: "USD", defaultCommissionPercentage: 10, defaultCommissionTrigger: "Fully Paid", visibility: "Assigned Countries", isActive: true })));
  });

  it("resellers PATCH (toggle)", async () => {
    const { PATCH } = await import("@/app/api/admin/resellers/route");
    const { upsertReseller } = await import("@/lib/dev-store");
    upsertReseller({ name: "Failing Reseller Co", countries: ["Lebanon"], defaultCurrency: "USD", defaultCommissionPercentage: 10, defaultCommissionTrigger: "Fully Paid", visibility: "Assigned Countries", isActive: true });
    await expectConnectionError(await PATCH(adminReq("PATCH", { name: "Failing Reseller Co", active: false })));
  });

  it("resellers/wizard POST", async () => {
    const { POST } = await import("@/app/api/admin/resellers/wizard/route");
    const { emptyWizardState } = await import("@/lib/admin/reseller-wizard");
    await expectConnectionError(await POST(adminReq("POST", {
      ...emptyWizardState(),
      name: "Failing Wizard Co",
      email: "contact@failingwizard.example",
      countries: ["Lebanon"],
      adminFirstName: "Sara",
      adminLastName: "Haddad",
      adminEmail: "sara.haddad@failingwizard.example",
      adminPassword: "password123",
      currencies: ["USD"],
      defaultCurrency: "USD",
      paymentMethods: ["Cash"],
    })));
  });

  it("white-label PATCH", async () => {
    const { PATCH } = await import("@/app/api/admin/white-label/route");
    await expectConnectionError(await PATCH(adminReq("PATCH", { platformName: "Cedar Cloud Partners" })));
  });
});
