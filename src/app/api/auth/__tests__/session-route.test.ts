import { describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { GET as session } from "@/app/api/auth/session/route";
import { SESSION_COOKIE } from "@/lib/auth/session-token";

function getSession(headers: Record<string, string>) {
  return session(new Request("https://portal.local/api/auth/session", { headers }));
}

function cookieFrom(setCookie: string | null): string {
  const m = setCookie?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return m?.[1] ?? "";
}

describe("GET /api/auth/session", () => {
  it("returns 401 with no session", async () => {
    const res = await getSession({});
    expect(res.status).toBe(401);
  });

  it("returns the identity from a valid login cookie (source=session-token)", async () => {
    const loginRes = await login(
      new Request("https://portal.local/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "5.5.5.1" },
        body: JSON.stringify({ email: "super.admin@lebtech.example", password: "LebTech!Admin#2026" }),
      }),
    );
    const token = cookieFrom(loginRes.headers.get("set-cookie"));
    expect(token).not.toBe("");

    const res = await getSession({ cookie: `${SESSION_COOKIE}=${token}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { user: { role: string; email: string }; source: string; impersonating: boolean };
    };
    expect(body.data.user.role).toBe("Super Admin");
    expect(body.data.user.email).toBe("super.admin@lebtech.example");
    expect(body.data.source).toBe("session-token");
    expect(body.data.impersonating).toBe(false);
  });

  it("reflects impersonation state via the dev header", async () => {
    const res = await getSession({
      "x-platform-user-id": "USR-SUPER",
      "x-platform-impersonate-user-id": "USR-SALES-RAMI",
    });
    const body = (await res.json()) as { data: { effectiveRole: string; impersonating: boolean } };
    expect(body.data.effectiveRole).toBe("Sales Team User");
    expect(body.data.impersonating).toBe(true);
  });
});
