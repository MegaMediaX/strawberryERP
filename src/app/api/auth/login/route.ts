import { NextResponse } from "next/server";

import { authenticate, getTotpSecretForUser } from "@/lib/auth/credentials";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session-token";
import { loginTotpCheck } from "@/lib/auth/totp";
import { portalUsers } from "@/lib/portal-security";

const TTL_MS = 12 * 60 * 60 * 1000;

export async function POST(request: Request) {
  let body: { email?: string; password?: string; totp?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; totp?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  const userId = authenticate(body.email ?? "", body.password ?? "");
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Invalid email or password." } },
      { status: 401 },
    );
  }

  // Second factor (only enforced when the user has 2FA enabled).
  const totpState = loginTotpCheck(getTotpSecretForUser(userId), body.totp);
  if (totpState !== "ok") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: totpState === "required" ? "TOTP_REQUIRED" : "TOTP_INVALID",
          message: totpState === "required" ? "A 2FA code is required." : "Invalid 2FA code.",
        },
      },
      { status: 401 },
    );
  }

  const user = portalUsers.find((u) => u.id === userId)!;
  const token = createSessionToken(userId, TTL_MS);

  const response = NextResponse.json({
    ok: true,
    data: { id: user.id, name: user.name, role: user.role, email: user.email },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
  return response;
}
