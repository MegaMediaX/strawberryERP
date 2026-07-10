import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADM-W8: portal users are frontend/dev-store identities, NOT Frappe `User`
 * records (see memory: portal-users-not-frappe-users — Link->User fields
 * break for them). users POST must stay 501 BACKEND_NOT_CONFIGURED even when
 * Frappe IS configured for other resources — there is deliberately no
 * frappeMethodMap["users"] entry and no maybeRouteToFrappe call in the route.
 * This locks that intent so a future dev doesn't "fix" the 501 by wiring a
 * broken User write.
 */
const frappeRequest = vi.fn(async (_path: string, _init?: { method: string; body?: unknown }) => ({ name: "should-never-be-called" }));
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
  frappeRequest: (path: string, init?: { method: string; body?: unknown }) => frappeRequest(path, init),
}));

function adminReq(method: "POST", body: unknown, userId = "USR-SUPER") {
  return new Request("https://portal.local/api/admin/users", {
    method,
    headers: { "x-platform-user-id": userId, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  frappeRequest.mockClear();
});

describe("ADM-W8: users POST stays 501 even when Frappe is configured", () => {
  it("returns 501 BACKEND_NOT_CONFIGURED for a fully valid user, never routing to Frappe", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(adminReq("POST", {
      firstName: "Jane", lastName: "Doe", email: "jane.doe@newmail.example",
      phone: "+96170000000", role: "Reseller Admin", countries: [],
      reseller: "Beirut Digital Partners", password: "password123",
    }));

    expect(res.status).toBe(501);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
    expect(frappeRequest).not.toHaveBeenCalled();
  });

  it("still 400s an invalid user before reaching the gate (guard-before-gate ordering preserved)", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(adminReq("POST", { firstName: "Jane", lastName: "Doe", email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(frappeRequest).not.toHaveBeenCalled();
  });
});
