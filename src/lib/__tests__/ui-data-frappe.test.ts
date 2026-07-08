import { describe, expect, it, vi } from "vitest";

/**
 * getUiLeads' Frappe branch (isolated in its own file — the mocks below are
 * hoisted file-wide, so they must not leak into the dev-store scoping tests
 * in ui-data.test.ts). Mirrors the pattern in
 * src/app/api/admin/__tests__/write-route-mapped-configured.test.ts.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
}));

const handle = vi.fn();
vi.mock("@/lib/backend/frappe-client", () => ({
  frappeBackendClient: { source: "frappe", handle: (...args: unknown[]) => handle(...args) },
}));

describe("getUiLeads — Frappe branch", () => {
  it("normalizeLead surfaces acquired_* fields (snake_case) as acquiredPhone/acquiredEmail/acquiredBy/acquiredAt", async () => {
    handle.mockResolvedValueOnce({
      source: "frappe",
      data: {
        message: [
          {
            name: "LEAD-9001",
            country: "Lebanon",
            reseller: "Beirut Digital Partners",
            assigned_user: "Marven El Mouallem",
            acquired_phone: "+96170144221",
            acquired_email: "captured@lead.com",
            acquired_by: "Marven El Mouallem",
            acquired_at: "2026-07-08T09:00:00.000Z",
          },
        ],
      },
    });

    const { getUiLeads } = await import("@/lib/ui-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/leads", { headers: { "x-platform-user-id": "USR-SUPER" } }));

    const result = await getUiLeads(session);
    expect(result.source).toBe("frappe");
    const [lead] = result.data;
    expect(lead.acquiredPhone).toBe("+96170144221");
    expect(lead.acquiredEmail).toBe("captured@lead.com");
    expect(lead.acquiredBy).toBe("Marven El Mouallem");
    expect(lead.acquiredAt).toBe("2026-07-08T09:00:00.000Z");
  });

  it("forwards leadsScopeForFrappe(session) as the get payload (defense-in-depth, not the only filter)", async () => {
    handle.mockResolvedValueOnce({ source: "frappe", data: { message: [] } });

    const { getUiLeads } = await import("@/lib/ui-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/leads", { headers: { "x-platform-user-id": "USR-SALES-MARVEN" } }));

    await getUiLeads(session);
    expect(handle).toHaveBeenCalledWith({ resource: "leads", method: "get", payload: { assigned_user: "Marven El Mouallem" } });
  });
});
