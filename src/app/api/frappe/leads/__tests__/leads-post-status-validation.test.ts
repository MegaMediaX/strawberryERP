import { describe, expect, it, vi } from "vitest";

/**
 * POST /api/frappe/leads boundary validation (route.ts:validateLeadPayload)
 * and create-time status defaulting. leads-post-required-fields.test.ts only
 * covers the required-field contract; this file covers the remaining
 * validateLeadPayload branches (status/followUpDate/country) plus the mapped
 * Frappe payload's default status (route.ts:112).
 */

const VALID_BASE = {
  companyName: "Cedar Cloud LLC",
  country: "Lebanon",
  assignedUser: "Marven El Mouallem",
  phone: "+961 70 123 456",
};

function post(body: Record<string, unknown>) {
  return import("@/app/api/frappe/leads/route").then(({ POST }) =>
    POST(
      new Request("https://portal.local/api/frappe/leads", {
        method: "POST",
        headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
        body: JSON.stringify(body),
      }),
    ),
  );
}

describe("POST /api/frappe/leads — status/country validation (dev-store, Frappe unconfigured)", () => {
  it("rejects an unsupported status", async () => {
    const res = await post({ ...VALID_BASE, status: "Made Up Status" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Unsupported lead status.");
  });

  it("requires followUpDate when status is Scheduled Follow-Up", async () => {
    const res = await post({ ...VALID_BASE, status: "Scheduled Follow-Up" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("followUpDate is required for Scheduled Follow-Up.");
  });

  it("accepts Scheduled Follow-Up when followUpDate is supplied", async () => {
    const res = await post({ ...VALID_BASE, status: "Scheduled Follow-Up", followUpDate: "2026-08-01" });
    expect(res.status).toBe(201);
  });

  it("blocks a disabled/unlisted country (e.g. Israel) even though every other field is valid", async () => {
    const res = await post({ ...VALID_BASE, country: "Israel" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Country is not enabled for LebTech Partner Platform.");
  });
});

describe("POST /api/frappe/leads — create-time status default (Frappe configured)", () => {
  it("defaults the mapped Frappe payload's status to 'New Lead (Uncontacted)' when the caller omits status", async () => {
    vi.resetModules();
    const frappeRequest = vi.fn(async (_path: string, _options: { body?: Record<string, unknown> }) => ({ name: "LEAD-9001" }));
    vi.doMock("@/lib/frappe-client", () => ({
      isFrappeConfigured: () => true,
      frappeRequest,
    }));

    const { POST } = await import("@/app/api/frappe/leads/route");
    const res = await POST(
      new Request("https://portal.local/api/frappe/leads", {
        method: "POST",
        headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
        body: JSON.stringify(VALID_BASE),
      }),
    );

    // maybeRouteToFrappe wraps the resolved Frappe call as 200 (no explicit
    // create-status override at the routing layer), unlike the dev-store
    // fallback which explicitly sets 201 for a create.
    expect(res.status).toBe(200);
    expect(frappeRequest).toHaveBeenCalledTimes(1);
    const [, options] = frappeRequest.mock.calls[0] as [string, { body?: Record<string, unknown> }];
    expect(options.body?.status).toBe("New Lead (Uncontacted)");

    vi.doUnmock("@/lib/frappe-client");
    vi.resetModules();
  });

  it("does NOT invent a status on a caller-supplied value — the caller's explicit status wins", async () => {
    vi.resetModules();
    const frappeRequest = vi.fn(async (_path: string, _options: { body?: Record<string, unknown> }) => ({ name: "LEAD-9002" }));
    vi.doMock("@/lib/frappe-client", () => ({
      isFrappeConfigured: () => true,
      frappeRequest,
    }));

    const { POST } = await import("@/app/api/frappe/leads/route");
    const res = await POST(
      new Request("https://portal.local/api/frappe/leads", {
        method: "POST",
        headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
        body: JSON.stringify({ ...VALID_BASE, status: "Contacted (Interested)" }),
      }),
    );

    expect(res.status).toBe(200);
    const [, options] = frappeRequest.mock.calls[0] as [string, { body?: Record<string, unknown> }];
    expect(options.body?.status).toBe("Contacted (Interested)");

    vi.doUnmock("@/lib/frappe-client");
    vi.resetModules();
  });
});
