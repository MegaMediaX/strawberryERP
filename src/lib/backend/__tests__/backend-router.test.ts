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

  it("returns null when Frappe is configured", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);

    const { writeRequiresBackend } = await import("@/lib/backend/backend-router");

    expect(writeRequiresBackend()).toBeNull();
  });
});
