import { describe, expect, it, vi } from "vitest";

/**
 * getUiCommissionEntries' Frappe branch, isolated in its own file (the vi.mock
 * calls below are hoisted file-wide, so they must not leak into dev-store
 * tests) — mirrors ui-data-frappe.test.ts / call-data-frappe.test.ts.
 *
 * Regression coverage for the prod "The Frappe commissions endpoint is
 * unavailable." banner: dashboards fetched resource "commissions", which had
 * no frappeMethodMap entry, so frappeBackendClient.handle() returned null
 * before any network call.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
}));

const handle = vi.fn();
vi.mock("@/lib/backend/frappe-client", () => ({
  frappeBackendClient: { source: "frappe", handle: (...args: unknown[]) => handle(...args) },
}));

const frappeRow = {
  name: "CENT-0001",
  commission_rule: "CRULE-001",
  reseller: "Beirut Digital Partners",
  country: "Lebanon",
  invoice: "INV-2026-004",
  receipt: "RCPT-0009",
  base_amount: 2500,
  commission_percentage: 12,
  commission_amount: 300,
  status: "Pending",
  calculated_at: "2026-07-08 09:00:00",
};

async function superAdminSession() {
  const { resolvePortalSession } = await import("@/lib/portal-security");
  return resolvePortalSession(new Request("https://x/admin", { headers: { "x-platform-user-id": "USR-SUPER" } }));
}

describe("getUiCommissionEntries — Frappe branch", () => {
  it('maps the "commissions" resource to list_commission_entries in frappeMethodMap', async () => {
    const { frappeMethodMap } = await import("@/lib/backend/backend-client");
    expect(frappeMethodMap["commissions"]?.get).toBe("lebtech_partner_platform.api.commissions.list_commission_entries");
  });

  it("normalizes a snake_case Frappe row into the camelCase CommissionEntry shape", async () => {
    handle.mockResolvedValueOnce({ source: "frappe", data: { message: [frappeRow] } });

    const { getUiCommissionEntries } = await import("@/lib/ui-data");
    const result = await getUiCommissionEntries(await superAdminSession());

    expect(handle).toHaveBeenCalledWith({ resource: "commissions", method: "get" });
    expect(result.source).toBe("frappe");
    expect(result.error).toBeUndefined();
    const [entry] = result.data;
    expect(entry.id).toBe("CENT-0001");
    expect(entry.commissionRule).toBe("CRULE-001");
    expect(entry.reseller).toBe("Beirut Digital Partners");
    expect(entry.country).toBe("Lebanon");
    expect(entry.invoice).toBe("INV-2026-004");
    expect(entry.receipt).toBe("RCPT-0009");
    expect(entry.baseAmount).toBe(2500);
    expect(entry.commissionPercentage).toBe(12);
    expect(entry.commissionAmount).toBe(300);
    expect(entry.status).toBe("Pending");
    expect(entry.calculatedAt).toBe("2026-07-08 09:00:00");
  });

  it("passes through already-camelCase rows unchanged (dev-store shape)", async () => {
    handle.mockResolvedValueOnce({
      source: "frappe",
      data: {
        message: [{
          id: "CENT-0002", commissionRule: "CRULE-002", reseller: "Nicosia Cloudworks", country: "Cyprus",
          invoice: "INV-2026-011", baseAmount: 1000, commissionPercentage: 8, commissionAmount: 80,
          status: "Approved", calculatedAt: "2026-07-01 10:00:00",
        }],
      },
    });

    const { getUiCommissionEntries } = await import("@/lib/ui-data");
    const result = await getUiCommissionEntries(await superAdminSession());

    const [entry] = result.data;
    expect(entry.id).toBe("CENT-0002");
    expect(entry.commissionAmount).toBe(80);
    expect(entry.receipt).toBeUndefined();
  });

  it("surfaces an error when the Frappe endpoint is unavailable (handle returns null)", async () => {
    handle.mockResolvedValueOnce(null);

    const { getUiCommissionEntries } = await import("@/lib/ui-data");
    const result = await getUiCommissionEntries(await superAdminSession());

    expect(result.data).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it("surfaces an error when the Frappe request throws", async () => {
    handle.mockRejectedValueOnce(new Error("connection refused"));

    const { getUiCommissionEntries } = await import("@/lib/ui-data");
    const result = await getUiCommissionEntries(await superAdminSession());

    expect(result.data).toEqual([]);
    expect(result.error).toBe("connection refused");
  });
});
