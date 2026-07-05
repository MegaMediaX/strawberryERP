import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/[...resource]/route";
import { paymentMethodNames, validatePaymentMethod } from "@/lib/business/payment-methods";

/**
 * Payment-method validation + create-route authorization (§3 / §9 / §18).
 */

const valid = {
  methodName: "Bank Transfer" as const,
  isActive: true,
  countries: ["Lebanon" as never],
  resellers: [],
  requiresReference: true,
  requiresAttachment: false,
  icon: "bank",
  displayOrder: 1,
};

describe("validatePaymentMethod", () => {
  it("accepts every supported method name", () => {
    for (const methodName of paymentMethodNames) {
      expect(validatePaymentMethod({ ...valid, methodName })).toBeNull();
    }
  });

  it("rejects an unknown method name", () => {
    expect(validatePaymentMethod({ ...valid, methodName: "Barter" as never })).toMatch(/Payment method must be one of/);
  });

  it("applies the country block to assigned countries", () => {
    expect(validatePaymentMethod({ ...valid, countries: ["Israel" as never] })).toMatch(/not enabled/);
  });

  it("requires a non-negative integer display order", () => {
    expect(validatePaymentMethod({ ...valid, displayOrder: -1 })).toMatch(/Display order/);
    expect(validatePaymentMethod({ ...valid, displayOrder: 1.5 })).toMatch(/Display order/);
  });
});

function post(body: Record<string, unknown>, opts: { userId?: string; impersonate?: string } = {}) {
  const resource = ["settings", "payment-methods"];
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-platform-user-id": opts.userId ?? "USR-SUPER",
  };
  if (opts.impersonate) headers["x-platform-impersonate-user-id"] = opts.impersonate;
  return POST(
    new Request("https://portal.local/api/frappe/settings/payment-methods", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource }) },
  );
}

describe("POST settings/payment-methods", () => {
  it("returns 501 BACKEND_NOT_CONFIGURED for a Super Admin when Frappe is unconfigured", async () => {
    const res = await post(valid);
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
  });

  it("rejects an invalid method (400)", async () => {
    expect((await post({ ...valid, methodName: "Barter" })).status).toBe(400);
  });

  it("denies a non-Super-Admin (403)", async () => {
    expect((await post(valid, { userId: "USR-RESELLER-BDP" })).status).toBe(403);
  });

  it("blocks an impersonating Super Admin (403)", async () => {
    expect((await post(valid, { userId: "USR-SUPER", impersonate: "USR-SALES-RAMI" })).status).toBe(403);
  });
});
