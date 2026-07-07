import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { resolvePortalSession } from "@/lib/portal-security";
import { buildWebrtcConfig, webrtcEnv } from "@/lib/telephony/webrtc";

export const dynamic = "force-dynamic";

/**
 * GET /api/telephony/webrtc-config — the authenticated rep's softphone config
 * (ADR 0001, Option B). Returns the WSS endpoint, the rep's SIP seat, and
 * freshly-minted short-lived TURN credentials. Placing a call is a real-world
 * action, so an impersonated session is refused (mirrors /api/calls/dial).
 */
export function GET(request: Request) {
  const session = resolvePortalSession(request);
  if (!session.authenticated) return jsonError("Sign in first.", 401);
  if (session.impersonatedBy) return jsonError("Calling is not available while impersonating.", 403);

  const config = buildWebrtcConfig(webrtcEnv(), session.user.id, Date.now() / 1000);
  if (!config) return jsonError("No telephony seat is configured for your account.", 404);

  return NextResponse.json({ ok: true, config });
}

// No-DELETE boundary (§18).
export function DELETE() {
  return deleteNotAllowed();
}
