import { NextResponse } from "next/server";

import { activateEnrollment } from "@/lib/auth/two-factor-store";
import { resolveExplicitPortalSession } from "@/lib/portal-security";

/** Confirm a 2FA enrollment by submitting a current code. */
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
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  if (!(await activateEnrollment(session.user.id, body.code ?? ""))) {
    return NextResponse.json(
      { ok: false, error: { code: "TOTP_INVALID", message: "Invalid or expired 2FA code." } },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, data: { twoFactorEnabled: true } });
}
