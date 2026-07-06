import { NextResponse } from "next/server";

import { disableTwoFactor, loginTwoFactorState } from "@/lib/auth/two-factor-store";
import { resolveExplicitPortalSession } from "@/lib/portal-security";

/**
 * Disable 2FA for the authenticated user.
 *
 * SEC-6: step-up re-authentication. Removing the second factor requires proving
 * current possession of it — a valid current TOTP code — so a hijacked/stolen
 * session (the exact threat 2FA defends against) cannot silently strip it. When
 * 2FA is not currently active there is nothing to protect, so no code is needed
 * (`loginTwoFactorState` returns "ok").
 */
export async function POST(request: Request) {
  const session = resolveExplicitPortalSession(request.headers);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first." } },
      { status: 401 },
    );
  }

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    // Tolerate an empty/missing body: the step-up check below still requires a
    // code whenever 2FA is active.
    body = {};
  }

  const state = await loginTwoFactorState(session.user.id, body.code);
  if (state === "required") {
    return NextResponse.json(
      { ok: false, error: { code: "TOTP_REQUIRED", message: "Enter your current 2FA code to disable two-factor." } },
      { status: 400 },
    );
  }
  if (state === "invalid") {
    return NextResponse.json(
      { ok: false, error: { code: "TOTP_INVALID", message: "Invalid or expired 2FA code." } },
      { status: 400 },
    );
  }

  await disableTwoFactor(session.user.id);
  return NextResponse.json({ ok: true, data: { twoFactorEnabled: false } });
}
