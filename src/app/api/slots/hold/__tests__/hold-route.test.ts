import { describe, expect, it } from "vitest";

import { POST as HOLD } from "@/app/api/slots/hold/route";
import { getSlotStatuses } from "@/lib/dev-store";

/**
 * SEC-1 regression: an unauthenticated request must never reach the slot-hold
 * state machine. `resolvePortalSession` fails closed to an inactive anonymous
 * user for a genuinely unauthenticated production request, but the route must
 * ALSO gate on `session.authenticated` itself (transport-level gate) — this
 * suite asserts the gate exists and that it doesn't break the legitimate
 * reseller path (dev-header identity, trusted only outside production).
 *
 * B1 is seeded with no explicit status entry in dev-store, so it defaults to
 * Available and is untouched by other slot tests/routes.
 */
const SLOT = "B1";

function holdRequest(body: unknown, headers: Record<string, string> = {}) {
  return HOLD(
    new Request("https://portal.local/api/slots/hold", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Outside production, dev-header identity is trusted for developer
 * convenience (NODE_ENV !== "production"), so an unauthenticated request
 * still resolves to a real (Super Admin default) user there. To exercise the
 * genuine anonymous-production path — a spoofable/missing identity with no
 * signed session cookie — force NODE_ENV=production for the duration of the
 * call, matching the pattern in production-api-auth.test.ts / login-route.test.ts.
 */
async function withProductionEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  try {
    // @ts-expect-error override for the test
    process.env.NODE_ENV = "production";
    return await fn();
  } finally {
    // @ts-expect-error restore
    process.env.NODE_ENV = original;
  }
}

describe("POST /api/slots/hold — auth gate (SEC-1)", () => {
  it("rejects an UNAUTHENTICATED request with 401 and does not change slot state", async () => {
    const before = getSlotStatuses()[SLOT];

    const res = await withProductionEnv(() =>
      holdRequest({ label: SLOT, action: "requestHold" }, { "x-platform-user-id": "USR-SUPER" }), // spoofed header must be ignored in production
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHENTICATED");

    const after = getSlotStatuses()[SLOT];
    expect(after).toEqual(before);
    expect(after?.status ?? "Available").toBe("Available");
  });

  it("allows an AUTHENTICATED reseller to requestHold on an Available slot (200)", async () => {
    const res = await holdRequest(
      { label: SLOT, action: "requestHold" },
      { "x-platform-user-id": "USR-SALES-MARVEN" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { status: { status: string } } };
    expect(body.ok).toBe(true);
    expect(body.data.status.status).toBe("OnHold");

    const after = getSlotStatuses()[SLOT];
    expect(after.status).toBe("OnHold");
  });
});
