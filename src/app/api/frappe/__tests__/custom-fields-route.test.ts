import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/[...resource]/route";

/**
 * Custom Field Builder create route — validation + §18 authorization:
 * only a non-impersonating Super Admin may create custom fields, and an invalid
 * definition is rejected at the boundary.
 */

const resource = ["settings", "custom-fields"];

function post(body: Record<string, unknown>, opts: { userId?: string; impersonate?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-platform-user-id": opts.userId ?? "USR-SUPER",
  };
  if (opts.impersonate) headers["x-platform-impersonate-user-id"] = opts.impersonate;
  return POST(
    new Request("https://portal.local/api/frappe/settings/custom-fields", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource }) },
  );
}

const validDef = { target: "leads", fieldName: "account_tier", label: "Account Tier", fieldType: "text" };

describe("POST settings/custom-fields", () => {
  it("creates a custom field for a Super Admin with a valid definition", async () => {
    const res = await post(validDef);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; data: { id: string } };
    expect(body.ok).toBe(true);
    expect(body.data.id).toMatch(/^CFD-/);
  });

  it("rejects an invalid definition with 400", async () => {
    const res = await post({ ...validDef, fieldType: "richtext" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { message: string } };
    expect(body.error.message).toMatch(/Field type must be one of/);
  });

  it("denies a non-Super-Admin (Reseller Admin)", async () => {
    const res = await post(validDef, { userId: "USR-RESELLER-BDP" });
    expect(res.status).toBe(403);
  });

  it("blocks a Super Admin who is impersonating (sensitive action)", async () => {
    const res = await post(validDef, { userId: "USR-SUPER", impersonate: "USR-SALES-RAMI" });
    expect(res.status).toBe(403);
  });
});
