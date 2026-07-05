import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/admin/users/route";

/**
 * Route-level guard: a partial/empty JSON body must be rejected with a clean 400
 * validation error, never an unhandled 500 (TypeError from .trim() on undefined).
 * The default test env resolves the caller as Super Admin, so the role guard
 * passes and validation is what runs.
 */
function adminReq(body: unknown) {
  return new Request("https://portal.local/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/users — empty/partial body", () => {
  it("returns 400 with the name message for an empty body ({})", async () => {
    const res = await POST(adminReq({}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toMatch(/first and last name/);
  });

  it("returns 400 for a partial body (name only, no email)", async () => {
    const res = await POST(adminReq({ firstName: "Lina", lastName: "Saad" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/valid email/);
  });
});
