import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GAP-2 (Super Admin parity): the sales persona shell must admit a Sales Team
 * User AND a Super Admin (oversight), mirroring the carve-out already present in
 * the regional and reseller shells — every other role is redirected to "/".
 * Regression guard for the omitted `role !== "Super Admin"` clause in
 * src/app/sales/layout.tsx that made /sales/* unreachable for a Super Admin even
 * though the underlying APIs already authorize them.
 */

const NEXT_REDIRECT = "NEXT_REDIRECT";

// vi.hoisted: vitest lifts vi.mock() factories above const declarations, so the
// mock fns they close over must be hoisted too (otherwise a TDZ ReferenceError).
const { redirect, getPortalUiSession } = vi.hoisted(() => ({
  // Real next/navigation redirect() throws to halt rendering — mirror that so a
  // guarded layout stops exactly where the redirect fires.
  redirect: vi.fn((_to: string) => {
    throw new Error("NEXT_REDIRECT");
  }),
  getPortalUiSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/lib/security/ui-session", () => ({ getPortalUiSession: () => getPortalUiSession() }));
vi.mock("@/lib/ui-data", () => ({ getUiLeads: async () => ({ data: [] }) }));
vi.mock("@/lib/sales/derive-notifications", () => ({ deriveNotifications: () => [] }));
// Persona-shell child components are referenced as element types only (never
// invoked here), but stub them so the import graph stays light + DOM-free.
vi.mock("@/components/sales/SalesNav", () => ({ SalesBottomNav: () => null, SalesTopNav: () => null }));
vi.mock("@/components/sales/SalesNotificationsBell", () => ({ SalesNotificationsBell: () => null }));
vi.mock("@/components/admin/ImpersonationBanner", () => ({ ImpersonationBanner: () => null }));

import SalesLayout from "@/app/sales/layout";

const session = (role: string) => ({ effectiveUser: { role, name: "Test User" } });

async function renderGuard(role: string | null): Promise<"rendered" | "redirected"> {
  getPortalUiSession.mockResolvedValue(role === null ? null : session(role));
  try {
    await SalesLayout({ children: null });
    return "rendered";
  } catch (e) {
    if (e instanceof Error && e.message === NEXT_REDIRECT) return "redirected";
    throw e;
  }
}

describe("SalesLayout access guard", () => {
  beforeEach(() => {
    redirect.mockClear();
    getPortalUiSession.mockReset();
  });

  it("admits a Sales Team User", async () => {
    expect(await renderGuard("Sales Team User")).toBe("rendered");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("admits a Super Admin (oversight parity)", async () => {
    expect(await renderGuard("Super Admin")).toBe("rendered");
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(["Reseller Admin", "Regional Director"])("redirects a %s to /", async (role) => {
    expect(await renderGuard(role)).toBe("redirected");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("redirects an unauthenticated visitor to /login", async () => {
    expect(await renderGuard(null)).toBe("redirected");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
