import { validateLeadTransition } from "@/lib/business/lead-workflow";
import { normalizeAcquiredInfo } from "@/lib/telephony/call-record";
import type { LeadStatus } from "@/lib/sample-data";

/**
 * Call disposition capture (ADR 0001, Phase 2). After a call, the agent tags an
 * outcome; that disposition maps to a lead-status transition and an optional
 * next follow-up date. Pure + unit-tested; the route applies the resulting
 * lead-override + audit entry.
 */

export const CALL_DISPOSITIONS = [
  "Interested",
  "Not interested",
  "No answer",
  "Awaiting response",
  "Callback scheduled",
] as const;

export type CallDisposition = (typeof CALL_DISPOSITIONS)[number];

/** Disposition → target lead status (spec §6 pipeline stages). */
const DISPOSITION_STATUS: Record<CallDisposition, LeadStatus> = {
  Interested: "Contacted (Interested)",
  "Not interested": "Contacted (Not Interested)",
  "No answer": "Attempted Contact (No Response)",
  "Awaiting response": "Contacted (Awaiting Response)",
  "Callback scheduled": "Scheduled Follow-Up",
};

/** Reverse of DISPOSITION_STATUS: the disposition that yields a target status.
 *  Every contacted status maps back to a disposition; "New Lead" does not (you
 *  can't transition *to* it), so the call screen falls back to a plain update. */
export function dispositionForStatus(status: string): CallDisposition | null {
  const found = (Object.keys(DISPOSITION_STATUS) as CallDisposition[]).find(
    (d) => DISPOSITION_STATUS[d] === status,
  );
  return found ?? null;
}

export interface DispositionInput {
  leadId: string;
  disposition: CallDisposition;
  notes?: string;
  followUpDate?: string;
  /** Optional link back to the logged call this disposition is for. */
  externalId?: string;
  /** "Acquired information" captured on the call — a new phone and/or email. */
  acquiredPhone?: string;
  acquiredEmail?: string;
}

export type DispositionParse =
  | { ok: true; value: DispositionInput }
  | { ok: false; error: string };

export function parseDispositionInput(body: unknown): DispositionParse {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  const leadId = typeof b.leadId === "string" ? b.leadId.trim() : "";
  if (!leadId) return { ok: false, error: "leadId is required." };

  const disposition = b.disposition;
  if (typeof disposition !== "string" || !CALL_DISPOSITIONS.includes(disposition as CallDisposition)) {
    return { ok: false, error: `disposition must be one of: ${CALL_DISPOSITIONS.join(", ")}.` };
  }

  const notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : undefined;
  const followUpDate = typeof b.followUpDate === "string" && b.followUpDate.trim() ? b.followUpDate.trim() : undefined;
  const externalId = typeof b.externalId === "string" && b.externalId.trim() ? b.externalId.trim() : undefined;
  const acquired = normalizeAcquiredInfo({ acquiredPhone: b.acquiredPhone, acquiredEmail: b.acquiredEmail });

  return {
    ok: true,
    value: { leadId, disposition: disposition as CallDisposition, notes, followUpDate, externalId, ...acquired },
  };
}

export interface DispositionResolution {
  targetStatus: LeadStatus;
  followUp?: string;
}

export type DispositionResult =
  | { ok: true; value: DispositionResolution }
  | { ok: false; error: string };

/**
 * Resolve a disposition against the lead's current status: map to the target
 * status and validate the transition (reusing validateLeadTransition, which
 * enforces e.g. that a scheduled follow-up carries a follow-up date).
 */
export function resolveDisposition(input: DispositionInput, currentStatus: string): DispositionResult {
  const targetStatus = DISPOSITION_STATUS[input.disposition];
  const error = validateLeadTransition(currentStatus, targetStatus, input.followUpDate);
  if (error) return { ok: false, error };
  return { ok: true, value: { targetStatus, ...(input.followUpDate ? { followUp: input.followUpDate } : {}) } };
}
