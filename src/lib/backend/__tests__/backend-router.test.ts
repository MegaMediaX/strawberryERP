import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: vi.fn(() => false),
}));

describe("writeRequiresBackend", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a 501 BACKEND_NOT_CONFIGURED response when Frappe is not configured", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(false);

    const { writeRequiresBackend, BACKEND_NOT_CONFIGURED_CODE } = await import("@/lib/backend/backend-router");

    const response = writeRequiresBackend();
    expect(response).not.toBeNull();
    expect(response!.status).toBe(501);

    const body = await response!.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
    expect(BACKEND_NOT_CONFIGURED_CODE).toBe("BACKEND_NOT_CONFIGURED");
  });

  it("APP-9: still returns 501 even when Frappe IS configured (the guard is only reached when a write did not route to Frappe)", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);

    const { writeRequiresBackend, BACKEND_NOT_CONFIGURED_CODE } = await import("@/lib/backend/backend-router");

    // Previously this returned null, letting an unmapped write fall through to a
    // fake-success dev-store response as soon as any Frappe env was set. It must
    // now fail loud so an unbacked write can never masquerade as durable.
    const response = writeRequiresBackend();
    expect(response).not.toBeNull();
    expect(response!.status).toBe(501);

    const body = await response!.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe(BACKEND_NOT_CONFIGURED_CODE);
  });
});
