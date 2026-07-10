import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/frappe-client", () => ({
  frappeRequest: vi.fn(),
}));

/**
 * COV-7: unit-test frappe-two-factor.ts (the Frappe `Portal Two Factor`
 * bridge) with frappe-client fully mocked — no live backend, no prod target.
 * Asserts method routing (the exact whitelisted method path), the
 * activate-flag 0/1 mapping, and boolean coercion of Frappe's response.
 */
describe("frappe-two-factor", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("enroll() posts to the whitelisted enroll method with user + secret", async () => {
    const { frappeRequest } = await import("@/lib/frappe-client");
    vi.mocked(frappeRequest).mockResolvedValue({ message: undefined });

    const { enroll } = await import("@/lib/auth/frappe-two-factor");
    await enroll("USR-SUPER", "JBSWY3DPEHPK3PXP");

    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.two_factor.enroll",
      { method: "POST", body: { user: "USR-SUPER", secret: "JBSWY3DPEHPK3PXP" } },
    );
  });

  it("verify() maps activate=true to 1 and activate=false to 0, and coerces a truthy ok", async () => {
    const { frappeRequest } = await import("@/lib/frappe-client");
    vi.mocked(frappeRequest).mockResolvedValue({ message: { ok: true } });

    const { verify } = await import("@/lib/auth/frappe-two-factor");
    const result = await verify("USR-SUPER", "123456", true);

    expect(result).toBe(true);
    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.two_factor.verify",
      { method: "POST", body: { user: "USR-SUPER", code: "123456", activate: 1 } },
    );
  });

  it("verify() with activate=false sends activate:0 and returns false for a falsy/missing ok", async () => {
    const { frappeRequest } = await import("@/lib/frappe-client");
    vi.mocked(frappeRequest).mockResolvedValue({ message: {} });

    const { verify } = await import("@/lib/auth/frappe-two-factor");
    const result = await verify("USR-SUPER", "000000", false);

    expect(result).toBe(false);
    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.two_factor.verify",
      { method: "POST", body: { user: "USR-SUPER", code: "000000", activate: 0 } },
    );
  });

  it("status() coerces a missing/falsy active flag to false and a truthy one to true", async () => {
    const { frappeRequest } = await import("@/lib/frappe-client");
    vi.mocked(frappeRequest).mockResolvedValueOnce({ message: { active: true } });

    const { status } = await import("@/lib/auth/frappe-two-factor");
    expect(await status("USR-SUPER")).toBe(true);
    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.two_factor.status",
      { method: "POST", body: { user: "USR-SUPER" } },
    );

    vi.mocked(frappeRequest).mockResolvedValueOnce({ message: {} });
    expect(await status("USR-SUPER")).toBe(false);
  });

  it("remove() posts to the whitelisted remove method with only the user", async () => {
    const { frappeRequest } = await import("@/lib/frappe-client");
    vi.mocked(frappeRequest).mockResolvedValue({ message: undefined });

    const { remove } = await import("@/lib/auth/frappe-two-factor");
    await remove("USR-SUPER");

    expect(frappeRequest).toHaveBeenCalledWith(
      "/api/method/lebtech_partner_platform.api.two_factor.remove",
      { method: "POST", body: { user: "USR-SUPER" } },
    );
  });
});
