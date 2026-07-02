import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { appendAudit, claimNextDial, resolveDial } from "@/lib/dev-store";
import { authorizeApiRequest } from "@/lib/security/permissions";
import type { DialStatus } from "@/lib/telephony/dial";

export const dynamic = "force-dynamic";

/** Machine-only guard: the middleware must present a telephony API key. */
function requireApiKey(request: Request) {
  const hasKey = request.headers.get("x-api-key-prefix") ?? request.headers.get("x-api-key-id");
  return hasKey ? null : jsonError("This endpoint requires a telephony API key.", 401);
}

/**
 * GET /api/calls/dial/next — the middleware pulls (claims) the next queued dial
 * command (ADR 0001, Phase 3, outbound-initiated channel). Requires read:calls.
 */
export async function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "calls", method: "GET" });
  if (denied) return denied;
  const keyDenied = requireApiKey(request);
  if (keyDenied) return keyDenied;

  const command = claimNextDial() ?? null;
  return NextResponse.json({ ok: true, command }, { status: 200 });
}

/**
 * POST /api/calls/dial/next — the middleware reports a dial result
 * ({ id, status: completed|failed, note? }). Requires write:calls.
 */
export async function POST(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "calls", method: "POST" });
  if (denied) return denied;
  const keyDenied = requireApiKey(request);
  if (keyDenied) return keyDenied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id.trim() : "";
  const status = b.status;
  if (!id) return jsonError("id is required.", 400);
  if (status !== "completed" && status !== "failed") {
    return jsonError("status must be 'completed' or 'failed'.", 400);
  }
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim() : undefined;

  const updated = resolveDial(id, status as DialStatus, note);
  if (!updated) return jsonError("Unknown dial command.", 404);

  appendAudit({
    entityType: updated.leadId ? "lead" : "call",
    entityId: updated.leadId ?? updated.id,
    action: "dial_result",
    oldValue: "",
    newValue: `${updated.number} ${status}`,
    performedBy: "telephony-middleware",
  });

  return NextResponse.json({ ok: true, id: updated.id, status: updated.status }, { status: 200 });
}

// No-DELETE boundary (§18).
export function DELETE() {
  return deleteNotAllowed();
}
