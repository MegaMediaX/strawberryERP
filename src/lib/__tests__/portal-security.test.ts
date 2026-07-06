import { describe, expect, it } from "vitest";

import { resolvePortalSession } from "@/lib/portal-security";

/**
 * SEC-3 regression: `ALLOW_DEV_IDENTITY_HEADERS=true` is the intended
 * "trusted reverse-proxy injects identity headers" production mode. A missing
 * or unknown `x-platform-user-id` in that mode must NEVER resolve to the
 * Super Admin default (portalUsers[0]) — it must fail closed to the
 * anonymous, inactive user. The local-dev "no headers ⇒ Super Admin"
 * convenience must still work when NODE_ENV is not "production".
 */

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key];
  }
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function withProductionProxyEnv<T>(fn: () => T): T {
  return withEnv(
    { NODE_ENV: "production", ALLOW_DEV_IDENTITY_HEADERS: "true" },
    fn,
  );
}

function req(headers: Record<string, string> = {}) {
  return new Request("https://portal.local/api/frappe/leads", { headers });
}

describe("resolvePortalSession — SEC-3 fail-closed defaults (production-proxy mode)", () => {
  it("a MISSING x-platform-user-id resolves to anonymous, inactive, NOT Super Admin", () => {
    withProductionProxyEnv(() => {
      const session = resolvePortalSession(req());
      expect(session.user.role).not.toBe("Super Admin");
      expect(session.user.id).toBe("ANON");
      expect(session.user.active).toBe(false);
      expect(session.effectiveUser.role).not.toBe("Super Admin");
    });
  });

  it("an UNKNOWN x-platform-user-id resolves to anonymous, NOT Super Admin (portalUsers[0])", () => {
    withProductionProxyEnv(() => {
      const session = resolvePortalSession(req({ "x-platform-user-id": "USR-DOES-NOT-EXIST" }));
      expect(session.user.role).not.toBe("Super Admin");
      expect(session.user.id).toBe("ANON");
      expect(session.user.active).toBe(false);
    });
  });

  it("an INACTIVE-looking / bogus id does not fall back to portalUsers[0]", () => {
    withProductionProxyEnv(() => {
      const session = resolvePortalSession(req({ "x-platform-user-id": "" }));
      // Empty header value is falsy, so this exercises the same missing-id path.
      expect(session.user.role).not.toBe("Super Admin");
      expect(session.user.id).toBe("ANON");
    });
  });

  it("a KNOWN, active x-platform-user-id in production-proxy mode still resolves normally", () => {
    withProductionProxyEnv(() => {
      const session = resolvePortalSession(req({ "x-platform-user-id": "USR-REG-LB" }));
      expect(session.user.role).toBe("Regional Director");
      expect(session.user.id).toBe("USR-REG-LB");
    });
  });
});

describe("resolvePortalSession — local-dev ergonomics preserved", () => {
  it("no header, NODE_ENV not production, no ALLOW_DEV_IDENTITY_HEADERS ⇒ still resolves Super Admin", () => {
    withEnv({ NODE_ENV: "test", ALLOW_DEV_IDENTITY_HEADERS: undefined }, () => {
      const session = resolvePortalSession(req());
      expect(session.user.role).toBe("Super Admin");
      expect(session.user.id).toBe("USR-SUPER");
    });
  });

  it("a known x-platform-user-id header outside production resolves that user as before", () => {
    withEnv({ NODE_ENV: "test", ALLOW_DEV_IDENTITY_HEADERS: undefined }, () => {
      const session = resolvePortalSession(req({ "x-platform-user-id": "USR-SALES-RAMI" }));
      expect(session.user.role).toBe("Sales Team User");
      expect(session.user.id).toBe("USR-SALES-RAMI");
    });
  });
});
