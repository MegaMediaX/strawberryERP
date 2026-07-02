/**
 * Telephony call-record model + pure helpers (ADR 0001, Phase 1).
 *
 * A CallRecord is the source-of-truth entity for a completed call reported by
 * the on-prem tinyphone middleware (see INTEGRATION_SPEC.md). Everything here is
 * pure and unit-tested; persistence (idempotent upsert by externalId) lives in
 * the dev-store, and the HTTP contract lives in src/app/api/calls/route.ts.
 */

export type CallDirection = "outbound" | "inbound";
export type CallOutcome = "answered" | "rang_no_answer";
export type CallLinkState = "linked" | "unlinked";

export interface CallRecord {
  /** Unique call id from the middleware (tinyphone sid). Idempotency key. */
  externalId: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  /** The external party, normalized. Dedupe/lookup key against leads/customers. */
  contactNumber: string;
  outcome: CallOutcome;
  answered: boolean;
  ringSeconds: number;
  talkSeconds: number;
  durationSeconds: number;
  /** ISO-8601 UTC, from the middleware. */
  startedAt: string;
  recordingFile: string | null;
  /** Softphone account + extension (forward-compat for per-user extensions). */
  account: string;
  extension: string;
  linkState: CallLinkState;
  /** Copy-down scoping fields, resolved from the linked entity at ingest time. */
  leadId?: string;
  customerId?: string;
  reseller?: string;
  country?: string;
  assignedTo?: string;
  /**
   * The sales agent this call is attributed to for KPIs. Best-effort: the linked
   * lead's assignedTo for auto-logged calls, or the click-to-call requester.
   * Full per-agent fidelity needs per-user extensions (ADR Phase 5).
   */
  agent?: string;
  /** Ingest timestamp (server clock). */
  loggedAt: string;
}

/** Minimal shape needed to link a call to a lead/customer (kept decoupled). */
export interface LinkableEntity {
  id: string;
  phone: string;
  country?: string;
  reseller?: string;
  assignedTo?: string;
}

/**
 * Normalize a phone/number to a comparable, E.164-ish form: strip spaces,
 * dashes, parens and dots; convert a leading international "00" prefix to "+".
 * Local numbers and internal extensions are left as digit strings.
 */
export function normalizePhone(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim().replace(/[\s()\-.]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  // Keep a single leading '+', drop any other non-digits.
  const plus = s.startsWith("+");
  s = s.replace(/[^\d]/g, "");
  return plus ? `+${s}` : s;
}

/**
 * Country-block (IL/ISR) at the telephony layer: reject Israeli E.164 numbers
 * (+972 / 00972). Defense-in-depth alongside the linked-entity country check.
 */
export function isBlockedPhone(raw: unknown): boolean {
  return normalizePhone(raw).startsWith("+972");
}

export interface ParsedCallPayload {
  externalId: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  contactNumber: string;
  outcome: CallOutcome;
  answered: boolean;
  ringSeconds: number;
  talkSeconds: number;
  durationSeconds: number;
  startedAt: string;
  recordingFile: string | null;
}

export type ParseResult =
  | { ok: true; value: ParsedCallPayload }
  | { ok: false; error: string };

const DIRECTIONS: CallDirection[] = ["outbound", "inbound"];
const OUTCOMES: CallOutcome[] = ["answered", "rang_no_answer"];

function nonNegInt(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/**
 * Validate + normalize the middleware's JSON contract. Rejects malformed
 * payloads (no partial writes upstream of this). Field names follow
 * INTEGRATION_SPEC.md §3 (snake_case).
 */
export function parseCallPayload(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  const externalId = typeof b.external_id === "string" ? b.external_id.trim() : "";
  if (!externalId) return { ok: false, error: "external_id is required." };

  const direction = b.direction;
  if (typeof direction !== "string" || !DIRECTIONS.includes(direction as CallDirection)) {
    return { ok: false, error: "direction must be 'outbound' or 'inbound'." };
  }

  const outcome = b.outcome;
  if (typeof outcome !== "string" || !OUTCOMES.includes(outcome as CallOutcome)) {
    return { ok: false, error: "outcome must be 'answered' or 'rang_no_answer'." };
  }

  const contactNumber = normalizePhone(b.contact_number);
  if (!contactNumber) return { ok: false, error: "contact_number is required." };

  const startedAtRaw = typeof b.started_at === "string" ? b.started_at : "";
  const startedMs = Date.parse(startedAtRaw);
  if (!startedAtRaw || Number.isNaN(startedMs)) {
    return { ok: false, error: "started_at must be a valid ISO-8601 timestamp." };
  }

  const recordingFileRaw = b.recording_file;
  const recordingFile =
    typeof recordingFileRaw === "string" && recordingFileRaw.trim() ? recordingFileRaw.trim() : null;

  return {
    ok: true,
    value: {
      externalId,
      direction: direction as CallDirection,
      fromNumber: normalizePhone(b.from_number),
      toNumber: normalizePhone(b.to_number),
      contactNumber,
      outcome: outcome as CallOutcome,
      answered: outcome === "answered" || b.answered === true,
      ringSeconds: nonNegInt(b.ring_seconds),
      talkSeconds: nonNegInt(b.talk_seconds),
      durationSeconds: nonNegInt(b.duration_seconds),
      startedAt: new Date(startedMs).toISOString(),
      recordingFile,
    },
  };
}

export interface CallLink {
  linkState: CallLinkState;
  leadId?: string;
  customerId?: string;
  reseller?: string;
  country?: string;
  assignedTo?: string;
}

/**
 * Resolve a call's external contact number to a lead or customer by normalized
 * phone. Customers take precedence (a graduated lead), then leads, else the
 * call lands unlinked (triage bucket — auto-create-lead is intentionally NOT
 * done here; that is an opt-in future step per ADR 0001).
 */
export function linkCall(
  contactNumber: string,
  leads: readonly LinkableEntity[],
  customers: readonly LinkableEntity[],
): CallLink {
  const target = normalizePhone(contactNumber);
  if (target) {
    const customer = customers.find((c) => normalizePhone(c.phone) === target);
    if (customer) {
      return {
        linkState: "linked",
        customerId: customer.id,
        reseller: customer.reseller,
        country: customer.country,
        assignedTo: customer.assignedTo,
      };
    }
    const lead = leads.find((l) => normalizePhone(l.phone) === target);
    if (lead) {
      return {
        linkState: "linked",
        leadId: lead.id,
        reseller: lead.reseller,
        country: lead.country,
        assignedTo: lead.assignedTo,
      };
    }
  }
  return { linkState: "unlinked" };
}

export interface BuildCallRecordOptions {
  account: string;
  extension: string;
  loggedAt: string;
  /** Explicit agent attribution (e.g. click-to-call requester). Falls back to
   *  the linked lead's assignedTo when omitted. */
  agent?: string;
}

/** Assemble the persisted CallRecord from a parsed payload + resolved link. */
export function buildCallRecord(
  payload: ParsedCallPayload,
  link: CallLink,
  opts: BuildCallRecordOptions,
): CallRecord {
  return {
    externalId: payload.externalId,
    direction: payload.direction,
    fromNumber: payload.fromNumber,
    toNumber: payload.toNumber,
    contactNumber: payload.contactNumber,
    outcome: payload.outcome,
    answered: payload.answered,
    ringSeconds: payload.ringSeconds,
    talkSeconds: payload.talkSeconds,
    durationSeconds: payload.durationSeconds,
    startedAt: payload.startedAt,
    recordingFile: payload.recordingFile,
    account: opts.account,
    extension: opts.extension,
    linkState: link.linkState,
    ...(link.leadId ? { leadId: link.leadId } : {}),
    ...(link.customerId ? { customerId: link.customerId } : {}),
    ...(link.reseller ? { reseller: link.reseller } : {}),
    ...(link.country ? { country: link.country } : {}),
    ...(link.assignedTo ? { assignedTo: link.assignedTo } : {}),
    ...((opts.agent ?? link.assignedTo) ? { agent: opts.agent ?? link.assignedTo } : {}),
    loggedAt: opts.loggedAt,
  };
}
