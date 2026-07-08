import { describe, expect, it, vi } from "vitest";

/**
 * POST /api/calls with Frappe CONFIGURED — the durable-write + live-linking
 * seam (T6). Isolated in its own file: the vi.mock calls below are hoisted
 * file-wide and must not leak into the dev-store-only tests in
 * calls-post.test.ts. Mirrors src/lib/__tests__/ui-data-frappe.test.ts and
 * src/app/api/admin/__tests__/write-route-mapped-configured.test.ts.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
}));

const handle = vi.fn();
vi.mock("@/lib/backend/frappe-client", () => ({
  frappeBackendClient: { source: "frappe", handle: (...args: unknown[]) => handle(...args) },
}));

const CALLS_KEY = "ltp_calls_test";

function post(body: unknown) {
  return import("@/app/api/calls/route").then(({ POST }) =>
    POST(
      new Request("https://portal.local/api/calls", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key-prefix": CALLS_KEY },
        body: JSON.stringify(body),
      }),
    ),
  );
}

function baseCall(overrides: Record<string, unknown> = {}) {
  return {
    external_id: `call-frappe-${Math.random().toString(36).slice(2)}`,
    direction: "inbound",
    from_number: "03123456",
    to_number: "1001",
    contact_number: "03123456",
    outcome: "answered",
    answered: true,
    ring_seconds: 4,
    talk_seconds: 30,
    duration_seconds: 34,
    started_at: "2026-07-02T09:15:03.000Z",
    recording_file: null,
    ...overrides,
  };
}

describe("POST /api/calls — Frappe CONFIGURED", () => {
  it("forwards the mapped record to Frappe (calls/post) and returns 201 on success", async () => {
    handle.mockImplementation(async ({ resource, method }: { resource: string; method: string }) => {
      if (resource === "leads" && method === "get") return { source: "frappe", data: { message: [] } };
      if (resource === "calls" && method === "post") {
        return { source: "frappe", data: { message: { name: "CALL-1", external_id: "x", created: true } } };
      }
      return null;
    });

    const externalId = "call-frappe-success";
    const res = await post(baseCall({ external_id: externalId, talk_seconds: 42 }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.external_id).toBe(externalId);

    const callsPostCall = handle.mock.calls.find(([arg]) => arg.resource === "calls" && arg.method === "post");
    expect(callsPostCall).toBeDefined();
    const payload = callsPostCall![0].payload as Record<string, unknown>;
    expect(payload.external_id).toBe(externalId);
    expect(payload.talk_seconds).toBe(42);
    expect(payload.link_state).toBe("unlinked"); // no matching lead phone in this case
  });

  it("links against a LIVE Frappe lead (not the static sample-data seed)", async () => {
    const livePhone = "+96170999999"; // not present in src/lib/sample-data.ts leads
    handle.mockImplementation(async ({ resource, method }: { resource: string; method: string }) => {
      if (resource === "leads" && method === "get") {
        return {
          source: "frappe",
          data: {
            message: [
              {
                name: "LEAD-LIVE-1",
                company_name: "Live Frappe Lead LLC",
                country: "Lebanon",
                reseller: "Beirut Digital Partners",
                assigned_user: "Marven El Mouallem",
                phone: livePhone,
                email: "live@lead.example",
              },
            ],
          },
        };
      }
      if (resource === "calls" && method === "post") {
        return { source: "frappe", data: { message: { name: "CALL-2", external_id: "x", created: true } } };
      }
      return null;
    });

    const externalId = "call-frappe-live-link";
    const res = await post(baseCall({ external_id: externalId, contact_number: livePhone }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.link_state).toBe("linked");

    const { getCallRecords } = await import("@/lib/dev-store");
    const rec = getCallRecords().find((c) => c.externalId === externalId);
    expect(rec?.leadId).toBe("LEAD-LIVE-1");
  });

  it("surfaces the proxied failure (502) when forwarding to Frappe throws — the call is NOT silently dropped", async () => {
    handle.mockImplementation(async ({ resource, method }: { resource: string; method: string }) => {
      if (resource === "leads" && method === "get") return { source: "frappe", data: { message: [] } };
      if (resource === "calls" && method === "post") throw new Error("frappe down");
      return null;
    });

    const externalId = "call-frappe-failure";
    const res = await post(baseCall({ external_id: externalId }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("FRAPPE_CONNECTION_ERROR");
  });
});
