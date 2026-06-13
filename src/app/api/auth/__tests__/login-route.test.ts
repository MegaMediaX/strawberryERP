import { describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { resolveExplicitPortalSession } from "@/lib/portal-security";

function loginReq(body: unknown) {
  return login(
    new Request("https://portal.local/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function cookieValue(setCookie: string | null): string {
  // e.g. "lebtech_session=<token>; Path=/; HttpOnly; ..."
  const match = setCookie?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? "";
}

describe("POST /api/auth/login", () => {
  it("authenticates the super admin and sets a session cookie", async () => {
    const res = await loginReq({ email: "super.admin@lebtech.example", password: "LebTech!Admin#2026" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { role: string } };
    expect(body.ok).toBe(true);
    expect(body.data.role).toBe("Super Admin");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(SESSION_COOKIE);
    expect(setCookie?.toLowerCase()).toContain("httponly");
  });

  it("rejects wrong credentials with 401 and no cookie token", async () => {
    const res = await loginReq({ email: "super.admin@lebtech.example", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body with 400", async () => {
    const res = await login(
      new Request("https://portal.local/api/auth/login", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("login → session cookie resolves a verified identity", () => {
  it("a cookie from a successful login resolves to the Super Admin session", async () => {
    const res = await loginReq({ email: "super.admin@lebtech.example", password: "LebTech!Admin#2026" });
    const token = cookieValue(res.headers.get("set-cookie"));
    expect(token).not.toBe("");

    const session = resolveExplicitPortalSession(new Headers({ cookie: `${SESSION_COOKIE}=${token}` }));
    expect(session).not.toBeNull();
    expect(session!.user.role).toBe("Super Admin");
    expect(session!.source).toBe("session-token");
  });

  it("a tampered cookie does not resolve (and is not trusted)", () => {
    const session = resolveExplicitPortalSession(
      new Headers({ cookie: `${SESSION_COOKIE}=forged.token` }),
    );
    expect(session).toBeNull();
  });
});

describe("§17 — dev identity header is fail-closed in production", () => {
  it("ignores x-platform-user-id when NODE_ENV=production (no signed cookie)", () => {
    const original = process.env.NODE_ENV;
    try {
      // @ts-expect-error - override for the test
      process.env.NODE_ENV = "production";
      const session = resolveExplicitPortalSession(new Headers({ "x-platform-user-id": "USR-SUPER" }));
      expect(session).toBeNull();
    } finally {
      // @ts-expect-error - restore
      process.env.NODE_ENV = original;
    }
  });

  it("still honors the dev header outside production", () => {
    const session = resolveExplicitPortalSession(new Headers({ "x-platform-user-id": "USR-SUPER" }));
    expect(session?.user.role).toBe("Super Admin");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie?.toLowerCase()).toMatch(/max-age=0/);
  });
});
