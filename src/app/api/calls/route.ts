import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { appendAudit, upsertCallRecord } from "@/lib/dev-store";
import { customers } from "@/lib/phase2-data";
import { leads } from "@/lib/sample-data";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import {
  buildCallRecord,
  isBlockedPhone,
  linkCall,
  parseCallPayload,
  type LinkableEntity,
} from "@/lib/telephony/call-record";

export const dynamic = "force-dynamic";

// Softphone identity (ADR 0001). One extension today; per-user extensions later
// swap these per middleware instance. Never a secret — just an SIP account tag.
const ACCOUNT = process.env.TELEPHONY_ACCOUNT ?? "1001@192.168.10.150";
const EXTENSION = process.env.TELEPHONY_EXTENSION ?? "1001";

/**
 * POST /api/calls — telephony call-log ingest (ADR 0001, Phase 1).
 * Auth: API key with the `write:calls` scope (authorizeApiRequest). Idempotent
 * upsert by external_id. Country-blocked numbers are rejected server-side.
 * Unknown numbers are stored unlinked (triage), never dropped or auto-lead'd.
 */
export async function POST(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "calls", method: "POST" });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = parseCallPayload(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  // Country block (IL/ISR) — server-side, defense in depth on ingest.
  if (
    isBlockedPhone(parsed.value.contactNumber) ||
    isBlockedPhone(parsed.value.fromNumber) ||
    isBlockedPhone(parsed.value.toNumber)
  ) {
    appendAudit({
      entityType: "call",
      entityId: parsed.value.externalId,
      action: "call_blocked_country",
      oldValue: "",
      newValue: parsed.value.contactNumber,
      performedBy: "telephony-middleware",
    });
    return jsonError("Calls to or from blocked countries are not accepted.", 403);
  }

  const leadEntities: LinkableEntity[] = leads.map((l) => ({
    id: l.id,
    phone: l.phone,
    country: l.country,
    reseller: l.reseller,
    assignedTo: l.assignedTo,
  }));
  const customerEntities: LinkableEntity[] = customers.map((c) => ({
    id: c.id,
    phone: (c as { phone?: string }).phone ?? "",
    country: c.country,
    reseller: c.reseller,
  }));

  const link = linkCall(parsed.value.contactNumber, leadEntities, customerEntities);
  const record = buildCallRecord(parsed.value, link, {
    account: ACCOUNT,
    extension: EXTENSION,
    loggedAt: new Date().toISOString(),
  });

  const { created } = upsertCallRecord(record);

  // Audit trail: the call appears on its linked entity (or as an unlinked call).
  appendAudit({
    entityType: link.leadId ? "lead" : link.customerId ? "customer" : "call",
    entityId: link.leadId ?? link.customerId ?? record.externalId,
    action: created ? "call_logged" : "call_updated",
    oldValue: "",
    newValue: `${record.direction} ${record.outcome} talk=${record.talkSeconds}s`,
    performedBy: "telephony-middleware",
  });

  const status = created ? 201 : 200;
  logSuccessfulApiRequest(request, "calls", "POST", status);
  return NextResponse.json(
    { ok: true, external_id: record.externalId, link_state: record.linkState, created },
    { status },
  );
}

// No-DELETE boundary (§18): corrections happen via idempotent re-POST only.
export function DELETE() {
  return deleteNotAllowed();
}
