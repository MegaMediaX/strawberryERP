import { describe, expect, it } from "vitest";

import { requireSuperAdmin } from "@/lib/security/admin-guard";

function req(userId: string) {
  return new Request("https://portal.local/api/admin/x", {
    headers: { "x-platform-user-id": userId },
  });
}

describe("requireSuperAdmin (APP-11 shared admin gate)", () => {
  it("allows a Super Admin — denied is null, session resolves", () => {
    const { denied, session } = requireSuperAdmin(req("USR-SUPER"));
    expect(denied).toBeNull();
    expect(session.user.role).toBe("Super Admin");
  });

  it("denies a non-Super-Admin with 403", async () => {
    const { denied, session } = requireSuperAdmin(req("USR-SALES-RAMI"));
    expect(session.user.role).not.toBe("Super Admin");
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(403);
    const body = (await denied!.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("Super Admin only.");
  });

  it("uses the real user role, not the impersonated one (Super Admin keeps access during Login-As)", () => {
    const request = new Request("https://portal.local/api/admin/x", {
      headers: { "x-platform-user-id": "USR-SUPER", "x-platform-impersonate-user-id": "USR-SALES-RAMI" },
    });
    const { denied } = requireSuperAdmin(request);
    expect(denied).toBeNull();
  });
});
