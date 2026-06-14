import { NextResponse } from "next/server";

import { disableTwoFactor } from "@/lib/auth/two-factor-store";
import { resolveExplicitPortalSession } from "@/lib/portal-security";

/** Disable 2FA for the authenticated user. */
export async function POST(request: Request) {
  const session = resolveExplicitPortalSession(request.headers);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first." } },
      { status: 401 },
    );
  }

  await disableTwoFactor(session.user.id);
  return NextResponse.json({ ok: true, data: { twoFactorEnabled: false } });
}
