import { NextResponse } from "next/server";

import { otpauthUrl } from "@/lib/auth/totp";
import { beginEnrollment } from "@/lib/auth/two-factor-store";
import { resolveExplicitPortalSession } from "@/lib/portal-security";

/**
 * Begin 2FA enrollment for the authenticated user. Returns the secret and an
 * otpauth:// URL to render as a QR code. The secret is NOT active until the user
 * confirms a code via /api/auth/2fa/activate.
 */
export async function POST(request: Request) {
  const session = resolveExplicitPortalSession(request.headers);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first." } },
      { status: 401 },
    );
  }

  const secret = beginEnrollment(session.user.id);
  return NextResponse.json({
    ok: true,
    data: { secret, otpauthUrl: otpauthUrl(secret, session.user.email) },
  });
}
