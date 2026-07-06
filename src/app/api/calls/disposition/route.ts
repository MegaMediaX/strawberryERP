import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { appendAudit, applyLeadOverride, setCallRecordAcquiredInfo } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest } from "@/lib/security/permissions";
import { parseDispositionInput, resolveDisposition } from "@/lib/telephony/disposition";
import { getUiLeads } from "@/lib/ui-data";

export const dynamic = "force-dynamic";

/**
 * POST /api/calls/disposition — capture a call's outcome (ADR 0001, Phase 2).
 * A Sales user tags a disposition on one of THEIR leads; it maps to a validated
 * lead-status transition + optional next follow-up date, and writes an audit
 * entry. Scope is enforced by getUiLeads (the lead must be in the caller's set).
 */
export async function POST(request: Request) {
  // A disposition is a lead write — authorize as such (session-scoped).
  const denied = authorizeApiRequest({ request, resource: "leads", method: "POST" });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = parseDispositionInput(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const session = resolvePortalSession(request);
  const leadsResult = await getUiLeads(session);
  const lead = leadsResult.data.find((l) => l.id === parsed.value.leadId);
  if (!lead) return jsonError("Lead is not in your scope, or does not exist.", 404);

  const resolved = resolveDisposition(parsed.value, lead.status);
  if (!resolved.ok) return jsonError(resolved.error, 400);

  applyLeadOverride(lead.id, {
    status: resolved.value.targetStatus,
    ...(resolved.value.followUp ? { followUp: resolved.value.followUp } : {}),
  });

  const performedBy = session.effectiveUser.name || session.effectiveUser.email || "sales";

  // "Acquired information" (ADR 0001): store a captured phone/email on the LEAD,
  // attributed to the acting agent. Lead-level so it ALWAYS persists — no
  // dependency on a client-supplied call id (which is why this never silently
  // drops). When a call is logged for this lead we also stamp it, ownership-
  // guarded, for live-mode fidelity. The per-agent KPI counts from the lead.
  const { acquiredPhone, acquiredEmail } = parsed.value; // already normalized/validated
  const acquiredInfoSaved = Boolean(acquiredPhone || acquiredEmail);
  if (acquiredInfoSaved) {
    applyLeadOverride(lead.id, {
      ...(acquiredPhone ? { acquiredPhone } : {}),
      ...(acquiredEmail ? { acquiredEmail } : {}),
      acquiredBy: performedBy,
      acquiredAt: new Date().toISOString(),
    });
    if (parsed.value.externalId) {
      setCallRecordAcquiredInfo(parsed.value.externalId, { acquiredPhone, acquiredEmail }, lead.id);
    }
    appendAudit({
      entityType: "lead",
      entityId: lead.id,
      action: "info_acquired",
      oldValue: "",
      newValue: [acquiredPhone && `phone ${acquiredPhone}`, acquiredEmail && `email ${acquiredEmail}`].filter(Boolean).join(" · "),
      performedBy,
    });
  }

  appendAudit({
    entityType: "lead",
    entityId: lead.id,
    action: "call_disposition",
    oldValue: lead.status,
    newValue: `${parsed.value.disposition}${parsed.value.notes ? `: ${parsed.value.notes}` : ""}`,
    performedBy,
  });

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.id,
      status: resolved.value.targetStatus,
      followUp: resolved.value.followUp ?? null,
      acquiredInfoSaved,
    },
    { status: 200 },
  );
}

// No-DELETE boundary (§18).
export function DELETE() {
  return deleteNotAllowed();
}
