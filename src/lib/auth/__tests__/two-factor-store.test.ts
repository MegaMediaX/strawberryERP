import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: vi.fn(() => false),
}));

vi.mock("@/lib/auth/frappe-two-factor", () => ({
  enroll: vi.fn(),
  verify: vi.fn(),
  status: vi.fn(),
  remove: vi.fn(),
}));

/**
 * COV-8: two-factor-store.ts Frappe branch. When isFrappeConfigured() is
 * true, every operation must delegate to the frappe-two-factor bridge
 * instead of the in-memory dev store — mocked here, no live backend.
 */
describe("two-factor-store — Frappe-configured branch", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("beginEnrollment() delegates to frappe2fa.enroll() and returns the generated secret", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    const frappe2fa = await import("@/lib/auth/frappe-two-factor");
    vi.mocked(frappe2fa.enroll).mockResolvedValue(undefined);

    const { beginEnrollment } = await import("@/lib/auth/two-factor-store");
    const secret = await beginEnrollment("USR-SUPER");

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(frappe2fa.enroll).toHaveBeenCalledWith("USR-SUPER", secret);
  });

  it("activateEnrollment() delegates to frappe2fa.verify(user, code, true) and returns its result", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    const frappe2fa = await import("@/lib/auth/frappe-two-factor");
    vi.mocked(frappe2fa.verify).mockResolvedValue(true);

    const { activateEnrollment } = await import("@/lib/auth/two-factor-store");
    const ok = await activateEnrollment("USR-SUPER", "123456");

    expect(ok).toBe(true);
    expect(frappe2fa.verify).toHaveBeenCalledWith("USR-SUPER", "123456", true);
  });

  it("disableTwoFactor() delegates to frappe2fa.remove()", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    const frappe2fa = await import("@/lib/auth/frappe-two-factor");
    vi.mocked(frappe2fa.remove).mockResolvedValue(undefined);

    const { disableTwoFactor } = await import("@/lib/auth/two-factor-store");
    await disableTwoFactor("USR-SUPER");

    expect(frappe2fa.remove).toHaveBeenCalledWith("USR-SUPER");
  });

  it("loginTwoFactorState() returns 'ok' when frappe2fa.status() reports 2FA inactive, without calling verify", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    const frappe2fa = await import("@/lib/auth/frappe-two-factor");
    vi.mocked(frappe2fa.status).mockResolvedValue(false);

    const { loginTwoFactorState } = await import("@/lib/auth/two-factor-store");
    const state = await loginTwoFactorState("USR-SUPER", undefined);

    expect(state).toBe("ok");
    expect(frappe2fa.verify).not.toHaveBeenCalled();
  });

  it("loginTwoFactorState() returns 'required' when active and no code was submitted", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    const frappe2fa = await import("@/lib/auth/frappe-two-factor");
    vi.mocked(frappe2fa.status).mockResolvedValue(true);

    const { loginTwoFactorState } = await import("@/lib/auth/two-factor-store");
    const state = await loginTwoFactorState("USR-SUPER", undefined);

    expect(state).toBe("required");
    expect(frappe2fa.verify).not.toHaveBeenCalled();
  });

  it("loginTwoFactorState() returns 'ok'/'invalid' based on frappe2fa.verify(user, code, false)", async () => {
    const { isFrappeConfigured } = await import("@/lib/frappe-client");
    vi.mocked(isFrappeConfigured).mockReturnValue(true);
    const frappe2fa = await import("@/lib/auth/frappe-two-factor");
    vi.mocked(frappe2fa.status).mockResolvedValue(true);
    vi.mocked(frappe2fa.verify).mockResolvedValueOnce(true);

    const { loginTwoFactorState } = await import("@/lib/auth/two-factor-store");
    expect(await loginTwoFactorState("USR-SUPER", "123456")).toBe("ok");
    expect(frappe2fa.verify).toHaveBeenCalledWith("USR-SUPER", "123456", false);

    vi.mocked(frappe2fa.verify).mockResolvedValueOnce(false);
    expect(await loginTwoFactorState("USR-SUPER", "000000")).toBe("invalid");
  });
});
