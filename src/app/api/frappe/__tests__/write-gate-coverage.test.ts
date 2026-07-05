import { describe, expect, it } from "vitest";

import { PATCH, POST } from "@/app/api/frappe/[...resource]/route";

/**
 * Point-of-persist gating coverage for the remaining /api/frappe/[...resource]
 * business-write branches not already covered by billing-settings-route,
 * custom-fields-route, customers-create-persistence, or patch-guards-security
 * test files: receipts, commissions/entries, settings/resellers, delete-queue,
 * settings/integrations.
 *
 * Each branch must (a) still run its existence/validation/permission guard
 * unconfigured (proving the gate sits at point-of-persist, not top-of-handler),
 * and (b) return 501 BACKEND_NOT_CONFIGURED once the guard has passed.
 */

function req(method: "POST" | "PATCH", resource: string[], body: Record<string, unknown>, opts: { userId?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-platform-user-id": opts.userId ?? "USR-SUPER",
  };
  return {
    request: new Request(`https://portal.local/api/frappe/${resource.join("/")}`, {
      method,
      headers,
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ resource }),
  };
}

async function post(resource: string[], body: Record<string, unknown>, opts: { userId?: string } = {}) {
  const { request, params } = req("POST", resource, body, opts);
  return POST(request, { params });
}

async function patch(resource: string[], body: Record<string, unknown>, opts: { userId?: string } = {}) {
  const { request, params } = req("PATCH", resource, body, opts);
  return PATCH(request, { params });
}

async function expectGateResponse(res: Response) {
  expect(res.status).toBe(501);
  const body = (await res.json()) as { ok: boolean; error: { code: string } };
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
}

describe("PATCH receipts", () => {
  it("404s on an unknown id before the write gate (guard reachable unconfigured)", async () => {
    const res = await patch(["receipts"], { id: "RCPT-DOES-NOT-EXIST", amount: 1 });
    expect(res.status).toBe(404);
  });

  it("returns 501 BACKEND_NOT_CONFIGURED for a known receipt", async () => {
    const res = await patch(["receipts"], { id: "RCPT-2026-0032", amount: 500 });
    await expectGateResponse(res);
  });
});

describe("PATCH commissions/entries", () => {
  it("404s on an unknown id before the write gate", async () => {
    const res = await patch(["commissions", "entries"], { id: "CENT-DOES-NOT-EXIST", status: "Approved" });
    expect(res.status).toBe(404);
  });

  it("rejects an unsupported status before the write gate", async () => {
    const res = await patch(["commissions", "entries"], { id: "CENT-0091", status: "Bogus" });
    expect(res.status).toBe(400);
  });

  it("returns 501 BACKEND_NOT_CONFIGURED for a known entry with a valid status", async () => {
    const res = await patch(["commissions", "entries"], { id: "CENT-0091", status: "Approved" }, { userId: "USR-SUPER" });
    await expectGateResponse(res);
  });
});

describe("POST settings/resellers", () => {
  it("rejects an invalid reseller definition before the write gate", async () => {
    const res = await post(["settings", "resellers"], { name: "" });
    expect(res.status).toBe(400);
  });

  it("returns 501 BACKEND_NOT_CONFIGURED for a valid reseller definition", async () => {
    const res = await post(["settings", "resellers"], {
      name: "New Reseller Co",
      countries: ["Lebanon"],
      defaultCurrency: "USD",
      defaultCommissionPercentage: 10,
      defaultCommissionTrigger: "Fully Paid",
      visibility: "Assigned Countries",
      isActive: true,
    });
    await expectGateResponse(res);
  });
});

describe("PATCH settings/resellers", () => {
  it("404s on an unknown name before the write gate", async () => {
    const res = await patch(["settings", "resellers"], { name: "Reseller That Does Not Exist" });
    expect(res.status).toBe(404);
  });

  it("returns 501 BACKEND_NOT_CONFIGURED for a known reseller", async () => {
    const res = await patch(["settings", "resellers"], { name: "Beirut Digital Partners", isActive: false });
    await expectGateResponse(res);
  });
});

describe("POST delete-queue", () => {
  it("returns 501 BACKEND_NOT_CONFIGURED once permission/role checks have passed", async () => {
    const res = await post(["delete-queue"], { entityType: "Invoice", entityId: "INV-2026-LB-0041", reason: "test" });
    await expectGateResponse(res);
  });
});

describe("POST delete-queue/resolve", () => {
  it("denies a non-Super-Admin before the write gate", async () => {
    const res = await post(["delete-queue", "resolve"], { id: "DEL-9001", status: "Restored" }, { userId: "USR-SALES-RAMI" });
    expect(res.status).toBe(403);
  });

  it("rejects an unsupported action before the write gate", async () => {
    const res = await post(["delete-queue", "resolve"], { id: "DEL-9001", status: "Bogus" });
    expect(res.status).toBe(400);
  });

  it("returns 501 BACKEND_NOT_CONFIGURED for a valid resolve action", async () => {
    const res = await post(["delete-queue", "resolve"], { id: "DEL-9001", status: "Restored" });
    await expectGateResponse(res);
  });
});

describe("PATCH delete-queue", () => {
  it("denies a non-Super-Admin before the write gate", async () => {
    const res = await patch(["delete-queue"], { id: "DEL-9001", status: "Restored" }, { userId: "USR-SALES-RAMI" });
    expect(res.status).toBe(403);
  });

  it("returns 501 BACKEND_NOT_CONFIGURED for a valid status", async () => {
    const res = await patch(["delete-queue"], { id: "DEL-9001", status: "Restored" });
    await expectGateResponse(res);
  });
});

describe("POST settings/integrations", () => {
  it("returns 501 BACKEND_NOT_CONFIGURED for a Super Admin", async () => {
    const res = await post(["settings", "integrations"], { integrationType: "WhatsApp", provider: "Meta" });
    await expectGateResponse(res);
  });
});

describe("PATCH settings/integrations", () => {
  it("returns 501 BACKEND_NOT_CONFIGURED for a Super Admin", async () => {
    const res = await patch(["settings", "integrations"], { integrationType: "WhatsApp", provider: "Meta" });
    await expectGateResponse(res);
  });
});
