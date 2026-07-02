import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { appendApiLog, appendAudit, upsertCallRecord } from "@/lib/dev-store";
import { customers } from "@/lib/phase2-data";
import { leads } from "@/lib/sample-data";
import { authorizeApiRequest } from "@/lib/security/permissions";
import {
  buildCallRecord,
  isBlockedPhone,
  linkCall,
  parseCallPayload,
  type LinkableEntity,
} from "@/lib/telephony/call-record";
import {
  checkRateLimit,
  verifyIngestSignature,
  type RateLimitBucket,
} from "@/lib/telephony/ingest-auth";

export const dynamic = "force-dynamic";

// Softphone identity (ADR 0001). One extension today; per-user extensions later
// swap these per middleware instance. Never a secret — just an SIP account tag.
const ACCOUNT = process.env.TELEPHONY_ACCOUNT ?? "1001@192.168.10.150";
const EXTENSION = process.env.TELEPHONY_EXTENSION ?? "1001";
// Shared HMAC secret for middleware→CRM ingest (Phase 2). Unset => signature
// check skipped (dev). Set in production so a leaked key alone can't forge logs.
const INGEST_SECRET = process.env.TELEPHONY_INGEST_SECRET || undefined;
const RATE_LIMIT_PER_MIN = Number(process.env.TELEPHONY_RATE_LIMIT ?? "120");

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
