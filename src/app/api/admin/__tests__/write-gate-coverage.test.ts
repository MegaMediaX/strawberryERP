import { describe, expect, it } from "vitest";

import { POST as currenciesPOST, PATCH as currenciesPATCH } from "@/app/api/admin/accounting/currencies/route";
import { POST as expensesPOST } from "@/app/api/admin/accounting/expenses/route";
import { PATCH as invoicingPATCH } from "@/app/api/admin/accounting/invoicing/route";
import { PATCH as paymentMethodsPATCH } from "@/app/api/admin/accounting/payment-methods/route";
import { POST as apiKeysPOST, PATCH as apiKeysPATCH } from "@/app/api/admin/api-keys/route";
import { PATCH as commissionsPATCH } from "@/app/api/admin/commissions/route";
import { POST as countriesPOST, PATCH as countriesPATCH } from "@/app/api/admin/countries/route";
import { POST as customFieldsPOST } from "@/app/api/admin/custom-fields/route";
import { PATCH as customersPATCH } from "@/app/api/admin/customers/route";
import { PATCH as deleteQueuePATCH, POST as deleteQueuePOST } from "@/app/api/admin/delete-queue/route";
import { POST as deleteRequestPOST } from "@/app/api/admin/delete-request/route";
import { PATCH as integrationsPATCH } from "@/app/api/admin/integrations/route";
import { PATCH as leadsPATCH } from "@/app/api/admin/leads/route";
import { POST as notificationsPOST, PATCH as notificationsPATCH } from "@/app/api/admin/notifications/route";
import { PATCH as permissionsPATCH } from "@/app/api/admin/permissions/route";
import { POST as resellersPOST, PATCH as resellersPATCH } from "@/app/api/admin/resellers/route";
import { POST as wizardPOST } from "@/app/api/admin/resellers/wizard/route";
import { PATCH as settingsPATCH } from "@/app/api/admin/settings/route";
import { POST as usersPOST } from "@/app/api/admin/users/route";
import { PATCH as userByIdPATCH } from "@/app/api/admin/users/[id]/route";
import { PATCH as whiteLabelPATCH } from "@/app/api/admin/white-label/route";

import { defaultPermissionMatrix } from "@/lib/admin/permission-matrix";
import { emptyWizardState } from "@/lib/admin/reseller-wizard";

/**
 * Exhaustive point-of-persist gating coverage for the admin write surface, one
 * describe per gated route. The default test env leaves Frappe unconfigured, so
 * every business write must:
 *   (a) return 501 BACKEND_NOT_CONFIGURED once its guards pass (fail-loud, no
 *       fake dev-store success), and
 *   (b) still short-circuit with its real guard status (403 / 404 / 400) BEFORE
 *       the gate — proving the gate sits at point-of-persist, not top-of-handler.
 *
 * The representative smoke in write-fail-loud.test.ts covers delete-request +
 * the exempt slots route; this file mirrors frappe/write-gate-coverage.test.ts
 * across the remaining ~19 routes.
 */
function adminReq(method: "POST" | "PATCH", body: unknown, userId = "USR-SUPER") {
  const headers: Record<string, string> = { "x-platform-user-id": userId };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request("https://portal.local/api/admin/x", init);
}

async function expectGate(res: Response) {
  expect(res.status).toBe(501);
  const body = (await res.json()) as { ok: boolean; error: { code: string } };
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
}

/** Assert a pre-gate guard fired (never the 501 gate). */
async function expectGuard(res: Response, status: number) {
  expect(res.status).toBe(status);
  expect(res.status).not.toBe(501);
}

describe("accounting/currencies", () => {
  it("POST 501 for a valid new currency", async () =>
    expectGate(await currenciesPOST(adminReq("POST", { currencyCode: "AED", currencyName: "UAE Dirham", symbol: "AED", decimalPrecision: 2, isActive: true, manualExchangeRate: 0.27 }))));
  it("POST 403 for a non-Super-Admin (guard before gate)", async () =>
    expectGuard(await currenciesPOST(adminReq("POST", { currencyCode: "AED", currencyName: "UAE Dirham", symbol: "AED", decimalPrecision: 2 }, "USR-SALES-RAMI")), 403));
  it("PATCH 404 for an unknown currency (guard before gate)", async () =>
    expectGuard(await currenciesPATCH(adminReq("PATCH", { currencyCode: "ZZZ", isActive: false })), 404));
});

describe("accounting/expenses", () => {
  it("POST 501 for a valid expense", async () =>
    expectGate(await expensesPOST(adminReq("POST", { category: "Marketing", amount: 500, currency: "USD", date: "2026-07-05", notes: "Q3 ads" }))));
  it("POST 400 for an invalid expense (guard before gate)", async () =>
    expectGuard(await expensesPOST(adminReq("POST", { category: "", amount: 0, currency: "", date: "" })), 400));
});

describe("accounting/invoicing", () => {
  it("PATCH 501 for valid numbering settings", async () =>
    expectGate(await invoicingPATCH(adminReq("PATCH", { mode: "Country Prefix", prefix: "LB", nextSequence: 42, pdfTemplate: "classic", qrCode: true, emailSend: true }))));
  it("PATCH 400 for an invalid numbering mode (guard before gate)", async () =>
    expectGuard(await invoicingPATCH(adminReq("PATCH", { mode: "Bogus" })), 400));
});

describe("accounting/payment-methods", () => {
  it("PATCH 501 for a known method", async () =>
    expectGate(await paymentMethodsPATCH(adminReq("PATCH", { methodName: "Cash", isActive: false, displayOrder: 1 }))));
  it("PATCH 404 for an unknown method (guard before gate)", async () =>
    expectGuard(await paymentMethodsPATCH(adminReq("PATCH", { methodName: "PayPal" })), 404));
});

describe("api-keys", () => {
  it("POST 501 for a valid key definition", async () =>
    expectGate(await apiKeysPOST(adminReq("POST", { keyName: "CI Bot", description: "pipeline", scopes: ["read:leads", "write:leads"], readAccess: true, writeAccess: true, rateLimitPerMinute: 60 }))));
  it("POST 403 for a non-Super-Admin (guard before gate)", async () =>
    expectGuard(await apiKeysPOST(adminReq("POST", { keyName: "CI Bot", scopes: ["read:leads"], readAccess: true }, "USR-SALES-RAMI")), 403));
  it("PATCH 404 revoking an unknown key (guard before gate)", async () =>
    expectGuard(await apiKeysPATCH(adminReq("PATCH", { id: "APIK-999", action: "revoke" })), 404));
});

describe("commissions", () => {
  it("PATCH 501 for a known entry action", async () =>
    expectGate(await commissionsPATCH(adminReq("PATCH", { id: "CENT-0091", action: "recalculate" }))));
  it("PATCH 404 for an unknown entry (guard before gate)", async () =>
    expectGuard(await commissionsPATCH(adminReq("PATCH", { id: "CENT-9999", action: "approve" })), 404));
});

describe("countries", () => {
  it("POST 501 for a valid new country", async () =>
    expectGate(await countriesPOST(adminReq("POST", { name: "Kuwait", currency: "KWD", timezone: "UTC", invoicePrefix: "KW-INV", paymentMethods: ["Cash"] }))));
  it("POST 400 for a blocked country (guard before gate)", async () =>
    expectGuard(await countriesPOST(adminReq("POST", { name: "Israel", currency: "USD", timezone: "UTC", invoicePrefix: "IL-INV" })), 400));
  it("PATCH 404 for an unknown country (guard before gate)", async () =>
    expectGuard(await countriesPATCH(adminReq("PATCH", { name: "Atlantis", active: false })), 404));
});

describe("custom-fields", () => {
  it("POST 501 for a valid new field", async () =>
    expectGate(await customFieldsPOST(adminReq("POST", { target: "customers", fieldName: "account_manager", label: "Account Manager", fieldType: "text", required: false, searchable: true }))));
  it("POST 403 for a non-Super-Admin (guard before gate)", async () =>
    expectGuard(await customFieldsPOST(adminReq("POST", { target: "customers", fieldName: "tier", label: "Tier", fieldType: "text" }, "USR-SALES-RAMI")), 403));
});

describe("customers", () => {
  it("PATCH 501 for a valid note on a known customer", async () =>
    expectGate(await customersPATCH(adminReq("PATCH", { customerId: "CUST-1008", action: "add_note", note: "Renewal discussion scheduled." }))));
  it("PATCH 404 for an unknown customer (guard before gate)", async () =>
    expectGuard(await customersPATCH(adminReq("PATCH", { customerId: "CUST-9999", action: "delete" })), 404));
});

describe("delete-queue", () => {
  it("POST clear-all 501 once confirmed", async () =>
    expectGate(await deleteQueuePOST(adminReq("POST", { action: "clear-all", confirm: "CLEAR ALL" }))));
  it("PATCH 403 for a non-Super-Admin (guard before gate)", async () =>
    expectGuard(await deleteQueuePATCH(adminReq("PATCH", { id: "DQ-1", action: "restore" }, "USR-SALES-RAMI")), 403));
});

describe("integrations", () => {
  it("PATCH 501 saving a valid integration type", async () =>
    expectGate(await integrationsPATCH(adminReq("PATCH", { integrationType: "SMTP", configJson: { host: "smtp.test" } }))));
  it("PATCH 400 for an unknown integration type (guard before gate)", async () =>
    expectGuard(await integrationsPATCH(adminReq("PATCH", { integrationType: "Bogus" })), 400));
});

describe("leads", () => {
  it("PATCH 501 converting a known lead", async () =>
    expectGate(await leadsPATCH(adminReq("PATCH", { leadId: "LEAD-2408", action: "convert" }))));
  it("PATCH 404 for an unknown lead (guard before gate)", async () =>
    expectGuard(await leadsPATCH(adminReq("PATCH", { leadId: "LEAD-9999", action: "convert" })), 404));
});

describe("notifications", () => {
  it("POST 501 for a valid rule", async () =>
    expectGate(await notificationsPOST(adminReq("POST", { eventType: "Invoice Issued", channels: ["Email", "WhatsApp"], templateMessage: "Your invoice is ready." }))));
  it("POST 400 for an unknown event type (guard before gate)", async () =>
    expectGuard(await notificationsPOST(adminReq("POST", { eventType: "Bad Event", channels: ["Email"], templateMessage: "hi" })), 400));
  it("PATCH 404 for an unknown rule (guard before gate)", async () =>
    expectGuard(await notificationsPATCH(adminReq("PATCH", { id: "NRULE-999", isActive: false })), 404));
});

describe("permissions", () => {
  it("PATCH 501 for a valid permission matrix", async () =>
    expectGate(await permissionsPATCH(adminReq("PATCH", defaultPermissionMatrix))));
  it("PATCH 403 for a non-Super-Admin (guard before gate)", async () =>
    expectGuard(await permissionsPATCH(adminReq("PATCH", {}, "USR-SALES-RAMI")), 403));
});

describe("resellers", () => {
  it("POST 501 for a valid reseller definition", async () =>
    expectGate(await resellersPOST(adminReq("POST", { name: "New Reseller Co", countries: ["Lebanon"], defaultCurrency: "USD", defaultCommissionPercentage: 10, defaultCommissionTrigger: "Fully Paid", visibility: "Assigned Countries", isActive: true }))));
  it("PATCH 404 for an unknown reseller (guard before gate)", async () =>
    expectGuard(await resellersPATCH(adminReq("PATCH", { name: "No Such Reseller", active: false })), 404));
});

describe("resellers/wizard", () => {
  it("POST 501 for a fully valid wizard state", async () =>
    expectGate(await wizardPOST(adminReq("POST", {
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
    }))));
  it("POST 400 for an incomplete wizard (guard before gate)", async () =>
    expectGuard(await wizardPOST(adminReq("POST", emptyWizardState())), 400));
});

describe("settings", () => {
  it("PATCH 501 for a valid general section", async () =>
    expectGate(await settingsPATCH(adminReq("PATCH", { section: "general", value: { defaultTimezone: "Asia/Beirut", defaultCurrency: "USD", dateFormat: "YYYY-MM-DD", supportEmail: "support@lebtech.example" } }))));
  it("PATCH 400 for an invalid section (guard before gate)", async () =>
    expectGuard(await settingsPATCH(adminReq("PATCH", { section: "bogus", value: {} })), 400));
});

describe("users", () => {
  it("POST 501 for a valid new user", async () =>
    expectGate(await usersPOST(adminReq("POST", { firstName: "Jane", lastName: "Doe", email: "jane.doe@newmail.example", phone: "+96170000000", role: "Reseller Admin", countries: [], reseller: "Beirut Digital Partners", password: "password123" }))));
  it("POST 400 for an invalid email (guard before gate)", async () =>
    expectGuard(await usersPOST(adminReq("POST", { firstName: "Jane", lastName: "Doe", email: "not-an-email" })), 400));
});

describe("users/[id]", () => {
  const withId = (method: "PATCH", body: unknown, id: string, userId = "USR-SUPER") => ({
    request: adminReq(method, body, userId),
    context: { params: Promise.resolve({ id }) },
  });
  it("PATCH 501 resetting a known user's password", async () => {
    const { request, context } = withId("PATCH", { action: "reset_password", password: "password123" }, "USR-SALES-RAMI");
    await expectGate(await userByIdPATCH(request, context));
  });
  it("PATCH 404 for an unknown user (guard before gate)", async () => {
    const { request, context } = withId("PATCH", { action: "reset_password", password: "password123" }, "USR-DOES-NOT-EXIST");
    await expectGuard(await userByIdPATCH(request, context), 404);
  });
});

describe("white-label", () => {
  it("PATCH 501 for a valid branding patch", async () =>
    expectGate(await whiteLabelPATCH(adminReq("PATCH", { platformName: "LebTech Partner Platform" }))));
  it("PATCH 403 for a non-Super-Admin (guard before gate)", async () =>
    expectGuard(await whiteLabelPATCH(adminReq("PATCH", {}, "USR-SALES-RAMI")), 403));
});
