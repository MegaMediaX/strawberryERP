import { afterEach, describe, expect, it, vi } from "vitest";

// frappeBackendClient.handle() is the drift-prone seam between the generic
// resource/method routing surface and the Frappe wire call: a bad
// resource->methodName lookup, a wrong HTTP-verb mapping, or a broken
// query-builder would all silently misroute or drop data with no test
// noticing. This isolates handle()/withQuery() from the real transport by
// mocking @/lib/frappe-client (frappeRequest + isFrappeConfigured).

vi.mock("@/lib/frappe-client", () => ({
  frappeRequest: vi.fn(),
  isFrappeConfigured: vi.fn(() => true),
}));

async function loadClient() {
  return import("@/lib/backend/frappe-client");
}

describe("frappeBackendClient.handle() — resource+method routing", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("maps a known resource+method to the mapped Frappe method path and GET verb", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeRequest).mockResolvedValue({ leads: [] });

    const { frappeBackendClient } = await loadClient();
    const result = await frappeBackendClient.handle({ resource: "leads", method: "get", payload: undefined });

    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.leads.list_leads",
      expect.objectContaining({ method: "GET", body: undefined }),
    );
    expect(result).toEqual({ source: "frappe", data: { leads: [] } });
  });

  it("maps resource+method 'post' to the create method and POST verb, forwarding the payload as the body", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeRequest).mockResolvedValue({ name: "LEAD-1" });

    const { frappeBackendClient } = await loadClient();
    const payload = { company: "Acme", country: "Lebanon" };
    await frappeBackendClient.handle({ resource: "leads", method: "post", payload });

    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.leads.create_lead",
      expect.objectContaining({ method: "POST", body: payload }),
    );
  });

  it("maps resource+method 'patch' to the update method but still issues an HTTP POST (Frappe whitelisted methods have no PATCH verb)", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeRequest).mockResolvedValue({ name: "LEAD-1" });

    const { frappeBackendClient } = await loadClient();
    const payload = { name: "LEAD-1", status: "Converted" };
    await frappeBackendClient.handle({ resource: "leads", method: "patch", payload });

    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.leads.update_lead",
      expect.objectContaining({ method: "POST", body: payload }),
    );
  });

  it("returns null for a resource with no mapping at all (unmapped resource)", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);

    const { frappeBackendClient } = await loadClient();
    const result = await frappeBackendClient.handle({ resource: "totally-unknown-resource", method: "get" });

    expect(result).toBeNull();
  });

  it("returns null for a mapped resource missing this specific method (e.g. contracts has no 'post')", async () => {
    // NOTE: this previously used resellers/'post' as the example, but the
    // admin write-path fix (ADM-W5, admin lane) legitimately added
    // resellers.post to frappeMethodMap so that resource is now mapped for
    // 'post' too — swapped to `contracts`, which remains read-only (list
    // only) and is unaffected by that change.
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);

    const { frappeBackendClient } = await loadClient();
    const result = await frappeBackendClient.handle({ resource: "contracts", method: "post", payload: {} });

    expect(result).toBeNull();
  });

  it("returns null when Frappe is not configured, even for a fully-mapped resource+method", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(false);

    const { frappeBackendClient } = await loadClient();
    const result = await frappeBackendClient.handle({ resource: "leads", method: "get" });

    expect(result).toBeNull();
    expect(frappeRequest).not.toHaveBeenCalled();
  });
});

describe("frappeBackendClient.handle() — GET query building (withQuery)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("appends a querystring built from the GET payload, coercing values with String()", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeRequest).mockResolvedValue([]);

    const { frappeBackendClient } = await loadClient();
    await frappeBackendClient.handle({
      resource: "leads",
      method: "get",
      payload: { assigned_user: "Marven El Mouallem", limit_page_length: 25 },
    });

    const [path] = vi.mocked(frappeRequest).mock.calls[0];
    expect(path).toContain("/api/method/lebtech_partner_platform.api.leads.list_leads?");
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("assigned_user")).toBe("Marven El Mouallem");
    expect(query.get("limit_page_length")).toBe("25");
  });

  it("skips undefined, null, and empty-string filter values (never sends them as empty query params)", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeRequest).mockResolvedValue([]);

    const { frappeBackendClient } = await loadClient();
    await frappeBackendClient.handle({
      resource: "leads",
      method: "get",
      payload: { country: undefined, reseller: null, status: "", assigned_user: "Elie Mouawad" },
    });

    const [path] = vi.mocked(frappeRequest).mock.calls[0];
    expect(path).not.toContain("country=");
    expect(path).not.toContain("reseller=");
    expect(path).not.toContain("status=");
    expect(path).toContain("assigned_user=Elie");
  });

  it("issues a bare (no querystring) GET when the payload is empty or absent", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeRequest).mockResolvedValue([]);

    const { frappeBackendClient } = await loadClient();
    await frappeBackendClient.handle({ resource: "leads", method: "get", payload: {} });

    const [path] = vi.mocked(frappeRequest).mock.calls[0];
    expect(path).toBe("/api/method/lebtech_partner_platform.api.leads.list_leads");
  });

  it("does not attempt query building for a POST/PATCH payload (query building is GET-only)", async () => {
    const { frappeRequest, isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    vi.mocked(frappeRequest).mockResolvedValue({});

    const { frappeBackendClient } = await loadClient();
    await frappeBackendClient.handle({ resource: "leads", method: "post", payload: { country: "Lebanon" } });

    const [path, options] = vi.mocked(frappeRequest).mock.calls[0];
    expect(path).toBe("/api/method/lebtech_partner_platform.api.leads.create_lead");
    expect(options).toMatchObject({ method: "POST", body: { country: "Lebanon" } });
  });
});
