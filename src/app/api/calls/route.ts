import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { appendApiLog, appendAudit, upsertCallRecord } from "@/lib/dev-store";
import { customers } from "@/lib/phase2-data";
import type { PortalSession, PortalUser } from "@/lib/portal-security";
import { allowedCountries } from "@/lib/sample-data";
import { authorizeApiRequest } from "@/lib/security/permissions";
import {
  buildCallRecord,
  isBlockedPhone,
  linkCall,
  parseCallPayload,
  type CallRecord,
  type LinkableEntity,
} from "@/lib/telephony/call-record";
import {
  checkRateLimit,
  verifyIngestSignature,
  type RateLimitBucket,
} from "@/lib/telephony/ingest-auth";
import { getUiLeads } from "@/lib/ui-data";

export const dynamic = "force-dynamic";

// Softphone identity (ADR 0001). One extension today; per-user extensions later
// swap these per middleware instance. Never a secret — just an SIP account tag.
const ACCOUNT = process.env.TELEPHONY_ACCOUNT ?? "1001@192.168.10.150";
const EXTENSION = process.env.TELEPHONY_EXTENSION ?? "1001";
// Shared HMAC secret for middleware→CRM ingest (Phase 2). Unset => signature
// check skipped (dev). Set in production so a leaked key alone can't forge logs.
const INGEST_SECRET = process.env.TELEPHONY_INGEST_SECRET || undefined;
const RATE_LIMIT_PER_MIN = Number(process.env.TELEPHONY_RATE_LIMIT ?? "120");

/**
 * Ingest is authenticated by the API-key + HMAC layers above (authorizeApiRequest,
 * verifyIngestSignature) — never by a portal user. Linking a call still needs a
 * PortalSession to call getUiLeads, so this is an internal, unscoped identity
 * (global read across every country) used ONLY to fetch the linking candidate
 * set. It is never returned to the caller or used for any authorization decision.
 */
function ingestSession(): PortalSession {
  const user: PortalUser = {
    id: "SYS-TELEPHONY-INGEST",
    name: "Telephony Ingest",
    email: "",
    role: "Super Admin",
    countries: [...allowedCountries],
    active: true,
  };
  return {
    user,
    effectiveUser: user,
    startedAt: new Date().toISOString(),
    source: "dev-header",
    auditLabel: "Telephony ingest (system)",
  };
}

/** CallRecord -> the snake_case payload upsert_call (frappe_app/.../api/calls.py) expects. */
function mapCallRecordToFrappe(record: CallRecord) {
  return {
    external_id: record.externalId,
    direction: record.direction,
    from_number: record.fromNumber,
    to_number: record.toNumber,
    contact_number: record.contactNumber,
    outcome: record.outcome,
    answered: record.answered,
    ring_seconds: record.ringSeconds,
    talk_seconds: record.talkSeconds,
    duration_seconds: record.durationSeconds,
    started_at: record.startedAt,
    recording_file: record.recordingFile,
    account: record.account,
    extension: record.extension,
    link_state: record.linkState,
    ...(record.leadId ? { lead: record.leadId } : {}),
    ...(record.customerId ? { customer: record.customerId } : {}),
    ...(record.reseller ? { reseller: record.reseller } : {}),
    ...(record.country ? { country: record.country } : {}),
    ...(record.assignedTo ? { assigned_to: record.assignedTo } : {}),
    ...(record.agent ? { agent: record.agent } : {}),
    ...(record.acquiredPhone ? { acquired_phone: record.acquiredPhone } : {}),
    ...(record.acquiredEmail ? { acquired_email: record.acquiredEmail } : {}),
    logged_at: record.loggedAt,
  };
}

// Fixed-window rate-limit state, per server instance (Phase 2).
const rateBucket: RateLimitBucket = new Map();

/** appendApiLog on EVERY ingest outcome (success or failure), keyed by prefix. */
function logIngest(request: Request, statusCode: number) {
  const keyId =
    request.headers.get("x-api-key-prefix") ??
    request.headers.get("x-api-key-id") ??
    "telephony";
  appendApiLog({
    apiKey: keyId,
    endpoint: "/api/calls",
    method: "POST",
    ipAddress: request.headers.get("x-forwarded-for") ?? "local",
    userAgent: request.headers.get("user-agent") ?? "telephony-middleware",
    statusCode,
    responseTimeMs: 0,
  });
}

/**
 * POST /api/calls — telephony call-log ingest (ADR 0001, Phases 1-2).
 * Layers: API-key `write:calls` scope → per-key rate limit → HMAC signature +
 * timestamp freshness (when a secret is configured) → validation → country
 * block → idempotent upsert by external_id. Every outcome is appendApiLog'd.
 */
export async function POST(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "calls", method: "POST" });
  if (denied) {
    logIngest(request, denied.status);
    return denied;
  }

  // Per-key rate limit (Phase 2).
  const rateKey = request.headers.get("x-api-key-prefix") ?? request.headers.get("x-api-key-id") ?? "telephony";
  if (!checkRateLimit(rateBucket, rateKey, RATE_LIMIT_PER_MIN, Date.now()).allowed) {
    logIngest(request, 429);
    return jsonError("Rate limit exceeded.", 429);
  }

  // Read the raw body once — the HMAC is computed over these exact bytes.
  const rawBody = await request.text();

  // HMAC signature + timestamp freshness (Phase 2). Fails closed when a secret
  // is configured; skipped (dev) when unset.
  const sig = verifyIngestSignature({
    rawBody,
    signature: request.headers.get("x-signature"),
    timestamp: request.headers.get("x-timestamp"),
    secret: INGEST_SECRET,
    nowMs: Date.now(),
  });
  if (!sig.ok) {
    logIngest(request, sig.status);
    return jsonError(sig.error, sig.status);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    logIngest(request, 400);
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = parseCallPayload(body);
  if (!parsed.ok) {
    logIngest(request, 400);
    return jsonError(parsed.error, 400);
  }

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
    logIngest(request, 403);
    return jsonError("Calls to or from blocked countries are not accepted.", 403);
  }

  // Live linking (Frappe seam): leads via getUiLeads, which returns the real
  // dev-store/Frappe-backed lead set (including Super-Admin reassign overrides)
  // instead of the frozen sample-data seed. Customers stay on the static seed —
  // no getUiRows-based customer fetch exists yet, and the seed customers have
  // no `phone` field so this branch of linkCall is already a no-op today; leads
  // are the KPI-critical link (T6a). Trade-off: this is a full lead scan per
  // ingest — acceptable at current call volume; index by phone if that grows.
  const leadsResult = await getUiLeads(ingestSession());
  const leadEntities: LinkableEntity[] = leadsResult.data.map((l) => ({
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

  // Durable write: forward to Frappe when configured. A failed proxy MUST
  // surface to the caller (mirrors the leads/disposition routes) — silently
  // keeping only the in-memory dev-store copy would look like success while a
  // live Frappe-backed KPI query never sees this call. The 502 is intentional:
  // it makes the middleware retry the POST (idempotent by external_id), so a
  // transient Frappe outage self-heals.
  const proxied = await maybeRouteToFrappe("calls", "post", mapCallRecordToFrappe(record));
  if (proxied && !proxied.ok) {
    logIngest(request, proxied.status);
    return proxied;
  }

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
  logIngest(request, status);
  return NextResponse.json(
    { ok: true, external_id: record.externalId, link_state: record.linkState, created },
    { status },
  );
}

// No-DELETE boundary (§18): corrections happen via idempotent re-POST only.
export function DELETE() {
  return deleteNotAllowed();
}
