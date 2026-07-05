import { describe, expect, it } from "vitest";

import { POST as deleteRequestPOST } from "@/app/api/admin/delete-request/route";
import { PATCH as slotStatusPATCH } from "@/app/api/admin/slots/status/route";

/**
 * Fail-loud smoke test for the admin write surface (Frappe unconfigured — the
 * default test env). Representative proof that:
 *  - a business write returns 501 BACKEND_NOT_CONFIGURED instead of faking success,
 *  - the gate sits AFTER the role/validation guards (they still short-circuit),
 *  - exempt local routes (slots) are never gated.
 * Exhaustive per-route coverage is tracked in the deep-wiring follow-up.
 */
function adminReq(method: "POST" | "PATCH", body: unknown, userId = "USR-SUPER") {
  const headers: Record<string, string> = { "x-platform-user-id": userId };
  const init: RequestInit = { method, headers };
  if (body) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request("https://portal.local/api/admin/x", init);
}

describe("admin write fail-loud gate (Frappe unconfigured)", () => {
  it("gates a business write with 501 BACKEND_NOT_CONFIGURED once its guards pass", async () => {
    const res = await deleteRequestPOST(adminReq("POST", { entityType: "lead", entityId: "LEAD-1", reason: "duplicate" }));
    expect(res.status).toBe(501);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
  });

  it("runs input validation BEFORE the gate (400 for a bad payload, not 501)", async () => {
    const res = await deleteRequestPOST(adminReq("POST", { entityType: "lead", entityId: "LEAD-1" })); // no reason
    expect(res.status).toBe(400);
  });

  it("runs the role guard BEFORE the gate (403 for a non-Super-Admin, not 501)", async () => {
    const res = await deleteRequestPOST(
      adminReq("POST", { entityType: "lead", entityId: "LEAD-1", reason: "duplicate" }, "USR-SALES-RAMI"),
    );
    expect(res.status).toBe(403);
  });

  it("does NOT gate exempt local routes (slots/status never returns BACKEND_NOT_CONFIGURED)", async () => {
    const res = await slotStatusPATCH(adminReq("PATCH", { label: "__no_such_slot__", action: "approve" }));
    expect(res.status).not.toBe(501);
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
    expect(body?.error?.code).not.toBe("BACKEND_NOT_CONFIGURED");
  });
});
