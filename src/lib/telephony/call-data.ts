import "server-only";

import { frappeBackendClient } from "@/lib/backend/frappe-client";
import { isFrappeConfigured } from "@/lib/frappe-client";
import { getCallRecords } from "@/lib/dev-store";
import type { PortalSession } from "@/lib/portal-security";
import { callsScopeForFrappe } from "@/lib/security/calls-scope";
import type { CallDirection, CallLinkState, CallOutcome, CallRecord } from "@/lib/telephony/call-record";
import type { UiDataResult } from "@/lib/ui-data";

/**
 * Dual-source read for telephony call records (Frappe seam). Dev branch reads
 * the in-memory store (getCallRecords, dev-store-only); Frappe branch queries
 * `list_calls` scoped to the caller's role via callsScopeForFrappe — mirrors
 * getUiLeads in src/lib/ui-data.ts. Callers should still run scopeCallRecords
 * over the result as defense-in-depth, same as the leads seam.
 */
export async function getUiCallRecords(session: PortalSession): Promise<UiDataResult<CallRecord[]>> {
  if (!isFrappeConfigured()) {
    return { source: "dev-store", data: getCallRecords() };
  }

  try {
    const result = await frappeBackendClient.handle({
      resource: "calls",
      method: "get",
      payload: callsScopeForFrappe(session),
    });
    if (!result) {
      return { source: "frappe", data: [], error: "The Frappe calls endpoint is unavailable." };
    }
    const rows = unwrapRows(result.data)
      .map(normalizeCallRecord)
      .filter((record): record is CallRecord => Boolean(record));
    return { source: "frappe", data: rows };
  } catch (error) {
    return {
      source: "frappe",
      data: [],
      error: error instanceof Error ? error.message : "Unable to load calls from Frappe.",
    };
  }
}

function unwrapRows(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  const message = (value as { message?: unknown }).message;
  const rows = Array.isArray(message) ? message : Array.isArray(value) ? value : [];
  return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

const DIRECTIONS: CallDirection[] = ["outbound", "inbound"];
const OUTCOMES: CallOutcome[] = ["answered", "rang_no_answer"];
const LINK_STATES: CallLinkState[] = ["linked", "unlinked"];

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function nonNegInt(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/**
 * Frappe returns Datetime as naive "YYYY-MM-DD HH:mm:ss" (UTC, no offset).
 * Date.parse treats that format as LOCAL time, so on a non-UTC host every
 * KPI date-window comparison would skew by the TZ offset. Normalize to
 * ISO-8601 UTC; strings that already carry a T/offset pass through unchanged.
 */
function toIsoUtc(v: string): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(v) ? `${v.replace(" ", "T")}Z` : v;
}

/**
 * Defensive snake_case row -> CallRecord mapping. A row missing a required
 * field or holding an out-of-set enum value is dropped (returns null) rather
 * than thrown — one malformed row must never break the whole KPI report.
 */
function normalizeCallRecord(row: Record<string, unknown>): CallRecord | null {
  const externalId = str(row.external_id ?? row.externalId);
  const direction = str(row.direction);
  const outcome = str(row.outcome);
  const linkState = str(row.link_state ?? row.linkState);
  const startedAt = toIsoUtc(str(row.started_at ?? row.startedAt));
  const contactNumber = str(row.contact_number ?? row.contactNumber);
  if (!externalId || !contactNumber || !startedAt) return null;
  if (!DIRECTIONS.includes(direction as CallDirection)) return null;
  if (!OUTCOMES.includes(outcome as CallOutcome)) return null;
  if (!LINK_STATES.includes(linkState as CallLinkState)) return null;

  const leadId = str(row.lead ?? row.leadId);
  const customerId = str(row.customer ?? row.customerId);
  const reseller = str(row.reseller);
  const country = str(row.country);
  const assignedTo = str(row.assigned_to ?? row.assignedTo);
  const agent = str(row.agent);
  const acquiredPhone = str(row.acquired_phone ?? row.acquiredPhone);
  const acquiredEmail = str(row.acquired_email ?? row.acquiredEmail);
  const recordingFile = str(row.recording_file ?? row.recordingFile);
  const loggedAt = toIsoUtc(str(row.logged_at ?? row.loggedAt));

  return {
    externalId,
    direction: direction as CallDirection,
    fromNumber: str(row.from_number ?? row.fromNumber),
    toNumber: str(row.to_number ?? row.toNumber),
    contactNumber,
    outcome: outcome as CallOutcome,
    answered: row.answered === true || row.answered === 1 || outcome === "answered",
    ringSeconds: nonNegInt(row.ring_seconds ?? row.ringSeconds),
    talkSeconds: nonNegInt(row.talk_seconds ?? row.talkSeconds),
    durationSeconds: nonNegInt(row.duration_seconds ?? row.durationSeconds),
    startedAt,
    recordingFile: recordingFile || null,
    account: str(row.account),
    extension: str(row.extension),
    linkState: linkState as CallLinkState,
    ...(leadId ? { leadId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(reseller ? { reseller } : {}),
    ...(country ? { country } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    ...(agent ? { agent } : {}),
    ...(acquiredPhone ? { acquiredPhone } : {}),
    ...(acquiredEmail ? { acquiredEmail } : {}),
    loggedAt: loggedAt || startedAt,
  };
}
