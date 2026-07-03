import { isBlockedPhone, normalizePhone } from "@/lib/telephony/call-record";

/**
 * Click-to-call command channel (ADR 0001, Phase 3 — CRM side, simulation mode).
 *
 * Topology: the CRM owns a dial QUEUE; the on-prem middleware long-polls for the
 * next command, dials via tinyphone, and reports the result. The CRM never
 * reaches into the LAN (NAT/mixed-content safe). Until the PBX outbound trunk is
 * provisioned for ext 1001, dials run in SIMULATION mode — clearly labelled, no
 * real call is placed. All pure/validated here; the queue lives in the dev-store.
 */

export type DialStatus = "queued" | "claimed" | "completed" | "failed" | "simulated";

export interface DialCommand {
  id: string;
  /** Normalized destination number. */
  number: string;
  leadId?: string;
  requestedBy: string;
  status: DialStatus;
  createdAt: string;
  claimedAt?: string;
  resolvedAt?: string;
  /** Result detail or simulation reason. */
  note?: string;
}

export interface DialRequest {
  number: string;
  leadId?: string;
}

export type DialParse =
  | { ok: true; value: DialRequest }
  | { ok: false; error: string; status: number };

/**
 * Validate a click-to-call request: a non-empty number, normalized, and NOT a
 * country-blocked (IL/ISR) destination (403). Never trusts the client to have
 * blocked it.
 */
export function validateDialRequest(body: unknown): DialParse {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be a JSON object.", status: 400 };
  }
  const b = body as Record<string, unknown>;
  const number = normalizePhone(b.number);
  if (!number) return { ok: false, error: "number is required.", status: 400 };
  if (isBlockedPhone(number)) {
    return { ok: false, error: "Dialing this country is blocked.", status: 403 };
  }
  const leadId = typeof b.leadId === "string" && b.leadId.trim() ? b.leadId.trim() : undefined;
  return { ok: true, value: { number, leadId } };
}

/** Whether real dialing is enabled (needs the PBX trunk + a live middleware). */
export function isLiveDialingEnabled(): boolean {
  return process.env.TELEPHONY_LIVE_DIAL === "true";
}

/**
 * Simulated dial outcome for dev-store mode: the call is NOT placed. Returns the
 * terminal status + a human note so the UI shows an honest reason rather than
 * pretending a call happened.
 *
 * The reason is the TELEPHONY_LIVE_DIAL flag being off (the PBX trunk for ext
 * 1001 is provisioned and verified — do NOT tell the operator otherwise). Going
 * live is a config + middleware step, not a telephony-hardware step.
 */
export function simulateDialResult(): { status: DialStatus; note: string } {
  return {
    status: "simulated",
    note: "Simulated — live dialing is off (set TELEPHONY_LIVE_DIAL=true and connect the dialer middleware to place real calls). No call was placed.",
  };
}
