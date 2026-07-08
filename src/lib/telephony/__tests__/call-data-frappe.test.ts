import { describe, expect, it, vi } from "vitest";

/**
 * getUiCallRecords' Frappe branch, isolated in its own file (the vi.mock calls
 * below are hoisted file-wide, so they must not leak into dev-store tests) —
 * mirrors src/lib/__tests__/ui-data-frappe.test.ts for getUiLeads.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
}));

const handle = vi.fn();
vi.mock("@/lib/backend/frappe-client", () => ({
  frappeBackendClient: { source: "frappe", handle: (...args: unknown[]) => handle(...args) },
}));

const baseRow = {
  external_id: "call-9001",
  direction: "outbound",
  from_number: "1001",
  to_number: "+96170144221",
  contact_number: "+96170144221",
  outcome: "answered",
  answered: true,
  ring_seconds: 3,
  talk_seconds: 90,
  duration_seconds: 93,
  started_at: "2026-07-08T09:00:00.000Z",
  recording_file: null,
  account: "1001@x",
  extension: "1001",
  link_state: "linked",
  lead: "LEAD-2408",
  reseller: "Beirut Digital Partners",
  country: "Lebanon",
  assigned_to: "Marven El Mouallem",
  agent: "Marven El Mouallem",
  acquired_phone: "+96170144222",
  acquired_email: "captured@lead.com",
  logged_at: "2026-07-08T09:01:00.000Z",
};

describe("getUiCallRecords — Frappe branch", () => {
  it("normalizes a snake_case Frappe row into a CallRecord", async () => {
    handle.mockResolvedValueOnce({ source: "frappe", data: { message: [baseRow] } });

    const { getUiCallRecords } = await import("@/lib/telephony/call-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/reports/call-kpis", { headers: { "x-platform-user-id": "USR-SUPER" } }));

    const result = await getUiCallRecords(session);
    expect(result.source).toBe("frappe");
    expect(result.error).toBeUndefined();
    const [call] = result.data;
    expect(call.externalId).toBe("call-9001");
    expect(call.talkSeconds).toBe(90);
    expect(call.leadId).toBe("LEAD-2408");
    expect(call.assignedTo).toBe("Marven El Mouallem");
    expect(call.acquiredPhone).toBe("+96170144222");
    expect(call.acquiredEmail).toBe("captured@lead.com");
    expect(call.recordingFile).toBeNull();
  });

  it("normalizes Frappe's naive 'YYYY-MM-DD HH:mm:ss' datetimes to ISO-UTC", async () => {
    // Frappe get_list returns Datetime with a space and no offset; Date.parse
    // reads that as LOCAL time, which would skew KPI windows on a non-UTC host.
    handle.mockResolvedValueOnce({
      source: "frappe",
      data: { message: [{ ...baseRow, started_at: "2026-07-08 09:00:00", logged_at: "2026-07-08 09:01:00" }] },
    });

    const { getUiCallRecords } = await import("@/lib/telephony/call-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/reports/call-kpis", { headers: { "x-platform-user-id": "USR-SUPER" } }));

    const result = await getUiCallRecords(session);
    const [call] = result.data;
    expect(call.startedAt).toBe("2026-07-08T09:00:00Z");
    expect(call.loggedAt).toBe("2026-07-08T09:01:00Z");
    expect(Date.parse(call.startedAt)).toBe(Date.parse("2026-07-08T09:00:00.000Z"));
  });

  it("drops a malformed row (bad direction) rather than throwing", async () => {
    handle.mockResolvedValueOnce({ source: "frappe", data: { message: [{ ...baseRow, direction: "sideways" }] } });

    const { getUiCallRecords } = await import("@/lib/telephony/call-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/reports/call-kpis", { headers: { "x-platform-user-id": "USR-SUPER" } }));

    const result = await getUiCallRecords(session);
    expect(result.data).toEqual([]);
  });

  it("forwards callsScopeForFrappe(session) as the get payload", async () => {
    handle.mockResolvedValueOnce({ source: "frappe", data: { message: [] } });

    const { getUiCallRecords } = await import("@/lib/telephony/call-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/reports/call-kpis", { headers: { "x-platform-user-id": "USR-SALES-MARVEN" } }));

    await getUiCallRecords(session);
    expect(handle).toHaveBeenCalledWith({ resource: "calls", method: "get", payload: { agent: "Marven El Mouallem" } });
  });

  it("surfaces an error when the Frappe endpoint is unavailable (handle returns null)", async () => {
    handle.mockResolvedValueOnce(null);

    const { getUiCallRecords } = await import("@/lib/telephony/call-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/reports/call-kpis", { headers: { "x-platform-user-id": "USR-SUPER" } }));

    const result = await getUiCallRecords(session);
    expect(result.data).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it("surfaces an error when the Frappe request throws", async () => {
    handle.mockRejectedValueOnce(new Error("connection refused"));

    const { getUiCallRecords } = await import("@/lib/telephony/call-data");
    const { resolvePortalSession } = await import("@/lib/portal-security");
    const session = resolvePortalSession(new Request("https://x/api/reports/call-kpis", { headers: { "x-platform-user-id": "USR-SUPER" } }));

    const result = await getUiCallRecords(session);
    expect(result.data).toEqual([]);
    expect(result.error).toBe("connection refused");
  });
});
