import { afterEach, describe, expect, it, vi } from "vitest";

// Isolates maybeRouteToFrappe(), the seam every write route calls BEFORE
// falling through to writeRequiresBackend()/devStoreResponse(). It is only
// ever exercised incidentally today (via the calls/admin route tests), so a
// regression here (e.g. losing the 502 mapping, or the null-passthrough that
// lets unmapped writes reach writeRequiresBackend) would surface as a prod
// 500-masquerade rather than a failing test. Existing
// src/lib/backend/__tests__/backend-router.test.ts (writeRequiresBackend) is
// left untouched — this is an additive new file per the dedupe plan.

vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: vi.fn(() => false),
}));

vi.mock("@/lib/backend/frappe-client", () => ({
  frappeBackendClient: { source: "frappe", handle: vi.fn() },
}));

async function loadRouter() {
  return import("@/lib/backend/backend-router");
}

describe("maybeRouteToFrappe", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns null immediately when Frappe is not configured (never calls handle())", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    const { frappeBackendClient } = await import("@/lib/backend/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(false);

    const { maybeRouteToFrappe } = await loadRouter();
    const result = await maybeRouteToFrappe("leads", "get");

    expect(result).toBeNull();
    expect(frappeBackendClient.handle).not.toHaveBeenCalled();
  });

  it("returns null (falls through to writeRequiresBackend) when handle() resolves null for an unmapped resource, even though Frappe IS configured", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    const { frappeBackendClient } = await import("@/lib/backend/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeBackendClient.handle).mockResolvedValue(null);

    const { maybeRouteToFrappe } = await loadRouter();
    const result = await maybeRouteToFrappe("currencies", "post", { code: "USD" });

    expect(result).toBeNull();
  });

  it("wraps a successful handle() result as { ok:true, source, data } with status 200 by default", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    const { frappeBackendClient } = await import("@/lib/backend/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeBackendClient.handle).mockResolvedValue({ source: "frappe", data: { name: "LEAD-1" } });

    const { maybeRouteToFrappe } = await loadRouter();
    const response = await maybeRouteToFrappe("leads", "patch", { name: "LEAD-1" });

    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body).toEqual({ ok: true, source: "frappe", data: { name: "LEAD-1" } });
  });

  it("honors a custom status from handle() (e.g. 201 create)", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    const { frappeBackendClient } = await import("@/lib/backend/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeBackendClient.handle).mockResolvedValue({
      source: "frappe",
      data: { name: "LEAD-2" },
      status: 201,
    });

    const { maybeRouteToFrappe } = await loadRouter();
    const response = await maybeRouteToFrappe("leads", "post", { company: "Acme" });

    expect(response!.status).toBe(201);
  });

  it("maps a thrown frappeRequest failure to a 502 FRAPPE_CONNECTION_ERROR response, never a fake success", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    const { frappeBackendClient } = await import("@/lib/backend/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeBackendClient.handle).mockRejectedValue(new Error("Frappe request failed (500): boom"));

    const { maybeRouteToFrappe } = await loadRouter();
    const response = await maybeRouteToFrappe("leads", "patch", { name: "LEAD-1" });

    expect(response).not.toBeNull();
    expect(response!.status).toBe(502);
    const body = await response!.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("FRAPPE_CONNECTION_ERROR");
    expect(body.error.message).toContain("Frappe request failed");
  });

  it("falls back to a generic message when the thrown value is not an Error instance", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    const { frappeBackendClient } = await import("@/lib/backend/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeBackendClient.handle).mockRejectedValue("network down");

    const { maybeRouteToFrappe } = await loadRouter();
    const response = await maybeRouteToFrappe("leads", "get");

    expect(response!.status).toBe(502);
    const body = await response!.json();
    expect(body.error.code).toBe("FRAPPE_CONNECTION_ERROR");
    expect(body.error.message).toBe("Frappe request failed.");
  });
});

describe("activeBackendSource", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reports 'frappe' when configured and 'dev-store' when not", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");

    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    const { activeBackendSource: activeConfigured } = await loadRouter();
    expect(activeConfigured()).toBe("frappe");

    vi.resetModules();
    const { isFrappeConfigured: isFrappeConfigured2 } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured2).mockReturnValue(false);
    const { activeBackendSource: activeUnconfigured } = await loadRouter();
    expect(activeUnconfigured()).toBe("dev-store");
  });
});
