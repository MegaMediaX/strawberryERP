import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { appendAudit, enqueueDial } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest } from "@/lib/security/permissions";
import { isLiveDialingEnabled, simulateDialResult, validateDialRequest } from "@/lib/telephony/dial";
import { getUiLeads } from "@/lib/ui-data";

export const dynamic = "force-dynamic";

/**
 * POST /api/calls/dial — request a click-to-call (ADR 0001, Phase 3, CRM side).
 * A Sales user enqueues a dial command; the on-prem middleware pulls it from
 * /api/calls/dial/next and reports the result. Country-blocked numbers are
 * refused (403), impersonated sessions may not place calls (403), and a named
 * lead must be in the caller's scope. Until the PBX trunk is provisioned the
 * command is resolved as SIMULATED (no real call) unless TELEPHONY_LIVE_DIAL=true.
 */
export async function POST(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "calls", method: "POST" });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  if (session.impersonatedBy) {
    return jsonError("Placing calls is not allowed while impersonating.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = validateDialRequest(body);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  // Scope: a named lead must belong to the caller's set.
  if (parsed.value.leadId) {
    const leadsResult = await getUiLeads(session);
    if (!leadsResult.data.some((l) => l.id === parsed.value.leadId)) {
      return jsonError("Lead is not in your scope, or does not exist.", 404);
    }
  }

  const live = isLiveDialingEnabled();
  const sim = live ? null : simulateDialResult();
  const requestedBy = session.effectiveUser.name || session.effectiveUser.email || "sales";
  const cmd = enqueueDial({
    number: parsed.value.number,
    leadId: parsed.value.leadId,
    requestedBy,
    ...(sim ? { status: sim.status, note: sim.note } : {}),
  });

  appendAudit({
    entityType: parsed.value.leadId ? "lead" : "call",
    entityId: parsed.value.leadId ?? cmd.id,
    action: "dial_requested",
    oldValue: "",
    newValue: `${cmd.number} (${cmd.status})`,
    performedBy: requestedBy,
  });

  return NextResponse.json(
    { ok: true, id: cmd.id, status: cmd.status, number: cmd.number, note: cmd.note ?? null, live },
    { status: 202 },
  );
}

// No-DELETE boundary (§18).
export function DELETE() {
  return deleteNotAllowed();
}
