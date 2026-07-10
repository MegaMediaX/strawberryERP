import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADM-W5: with Frappe CONFIGURED, assert the *exact* field-mapped payload
 * countries / resellers / resellers-wizard / white-label hand to frappeRequest
 * — not just that they route to Frappe (write-route-mapped-configured.test.ts
 * already proves source:"frappe"). A route can pass that source check while
 * still silently dropping/mis-naming fields (is_enabled, payment_methods,
 * commission_rate/trigger, visibility_rules_json, the merged white-label
 * blob) — the exact bug class PR #22 fixes for Partner Country writes.
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

function lastCall() {
  const call = frappeRequest.mock.calls.at(-1);
  if (!call) throw new Error("frappeRequest was never called");
  const [path, init] = call as [string, { method: string; body: unknown }];
  return { path, method: init.method, body: init.body as Record<string, unknown> };
}

beforeEach(() => {
  frappeRequest.mockClear();
});

describe("ADM-W5: countries payload shape", () => {
  it("POST create_country carries all mapped fields + defaults is_enabled=1", async () => {
    const { POST } = await import("@/app/api/admin/countries/route");
    await POST(adminReq("POST", { name: "Kuwait", currency: "KWD", timezone: "Asia/Kuwait", invoicePrefix: "KW-INV", paymentMethods: ["Cash", "Wire"] }));

    const { path, method, body } = lastCall();
    expect(path).toBe("/api/method/lebtech_partner_platform.api.countries.create_country");
    expect(method).toBe("POST");
    expect(body).toMatchObject({
      country_name: "Kuwait",
      currency: "KWD",
      timezone: "Asia/Kuwait",
      invoice_prefix: "KW-INV",
      payment_methods: ["Cash", "Wire"],
      is_enabled: 1,
    });
  });

  it("PATCH toggle sends only country_name + is_enabled (does not resend unrelated form fields)", async () => {
    const { PATCH } = await import("@/app/api/admin/countries/route");
    const { upsertCountry } = await import("@/lib/dev-store");
    // The guard reads from the dev-store even when Frappe is configured (the
    // write itself routes to Frappe, but the pre-gate "does this exist"
    // lookup is dev-store-local) — seed it so PATCH passes the guard.
    upsertCountry({ name: "Kuwait", currency: "KWD", timezone: "Asia/Kuwait", invoicePrefix: "KW-INV", active: true, paymentMethods: [] });

    await PATCH(adminReq("PATCH", { name: "Kuwait", active: false }));

    const { path, body } = lastCall();
    expect(path).toBe("/api/method/lebtech_partner_platform.api.countries.update_country");
    expect(body).toEqual({ country_name: "Kuwait", is_enabled: 0 });
  });

  it("PATCH settings-edit carries the field-mapped body (no is_enabled — must not touch the toggle)", async () => {
    const { PATCH } = await import("@/app/api/admin/countries/route");
    const { upsertCountry } = await import("@/lib/dev-store");
    upsertCountry({ name: "Kuwait", currency: "KWD", timezone: "Asia/Kuwait", invoicePrefix: "KW-INV", active: true, paymentMethods: [] });

    await PATCH(adminReq("PATCH", { name: "Kuwait", currency: "USD", timezone: "UTC", invoicePrefix: "KW-2", paymentMethods: ["Wire"] }));

    const { path, body } = lastCall();
    expect(path).toBe("/api/method/lebtech_partner_platform.api.countries.update_country");
    expect(body).toEqual({
      country_name: "Kuwait",
      currency: "USD",
      timezone: "UTC",
      invoice_prefix: "KW-2",
      payment_methods: ["Wire"],
    });
    expect(body).not.toHaveProperty("is_enabled");
  });
});

describe("ADM-W5: resellers payload shape", () => {
  it("POST create_reseller carries countries + commission + visibility fields", async () => {
    const { POST } = await import("@/app/api/admin/resellers/route");
    await POST(adminReq("POST", {
      name: "New Reseller Co",
      countries: ["Lebanon", "Cyprus"],
      defaultCurrency: "USD",
      defaultCommissionPercentage: 12,
      defaultCommissionTrigger: "Fully Paid",
      visibility: "Assigned Countries",
      isActive: true,
    }));

    const { path, method, body } = lastCall();
    expect(path).toBe("/api/method/lebtech_partner_platform.api.operations.create_reseller");
    expect(method).toBe("POST");
    expect(body).toMatchObject({
      reseller_name: "New Reseller Co",
      countries: ["Lebanon", "Cyprus"],
      default_currency: "USD",
      commission_rate: 12,
      commission_trigger: "Fully Paid",
      is_active: 1,
    });
    expect(JSON.parse(body.visibility_rules_json as string)).toEqual({ visibility: "Assigned Countries" });
  });

  it("PATCH toggle sends only reseller_name + is_active", async () => {
    const { PATCH } = await import("@/app/api/admin/resellers/route");
    const { upsertReseller } = await import("@/lib/dev-store");
    upsertReseller({
      name: "New Reseller Co", countries: ["Lebanon"], defaultCurrency: "USD",
      defaultCommissionPercentage: 12, defaultCommissionTrigger: "Fully Paid",
      visibility: "Assigned Countries", isActive: true,
    });

    await PATCH(adminReq("PATCH", { name: "New Reseller Co", active: false }));

    const { path, body } = lastCall();
    expect(path).toBe("/api/method/lebtech_partner_platform.api.operations.update_reseller");
    expect(body).toEqual({ reseller_name: "New Reseller Co", is_active: 0 });
  });
});

describe("ADM-W5: resellers/wizard payload shape", () => {
  it("POST create_reseller carries the wizard's branding + visibility blobs", async () => {
    const { POST } = await import("@/app/api/admin/resellers/wizard/route");
    const { emptyWizardState } = await import("@/lib/admin/reseller-wizard");

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
    }));

    const { path, method, body } = lastCall();
    expect(path).toBe("/api/method/lebtech_partner_platform.api.operations.create_reseller");
    expect(method).toBe("POST");
    expect(body.reseller_name).toBe("Tripoli Tech Partners");
    expect(body.countries).toEqual(["Lebanon"]);
    expect(body.default_currency).toBe("USD");
    expect(typeof body.visibility_rules_json).toBe("string");
    expect(typeof body.portal_branding_json).toBe("string");
  });
});

describe("ADM-W5: white-label payload shape", () => {
  it("PATCH save_white_label sends the FULL merged settings blob (mergeWhiteLabel output), not the raw partial patch", async () => {
    const { PATCH } = await import("@/app/api/admin/white-label/route");
    const { defaultWhiteLabel } = await import("@/lib/admin/white-label");

    await PATCH(adminReq("PATCH", { platformName: "Cedar Cloud Partners" }));

    const { path, method, body } = lastCall();
    expect(path).toBe("/api/method/lebtech_partner_platform.api.settings.save_white_label");
    expect(method).toBe("POST");
    // Only platformName was patched — every other key must still be present
    // (the merged blob), not just the single changed field.
    expect(body.settings).toEqual({ ...defaultWhiteLabel, platformName: "Cedar Cloud Partners" });
  });
});
