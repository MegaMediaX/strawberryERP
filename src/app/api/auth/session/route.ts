import { NextResponse } from "next/server";

import { resolveExplicitPortalSession } from "@/lib/portal-security";

/**
 * "Who am I" — returns the current authenticated identity for the frontend.
 * Resolves from the verified signed session cookie (or dev identity header
 * outside production). 401 when there is no valid session.
 *
 * Never leaks secrets — only id/name/role/email and impersonation state.
 */
export async function GET(request: Request) {
  const session = resolveExplicitPortalSession(request.headers);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "No active session." } },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      },
      effectiveRole: session.effectiveUser.role,
      impersonating: Boolean(session.impersonatedBy),
      source: session.source,
    },
  });
}
