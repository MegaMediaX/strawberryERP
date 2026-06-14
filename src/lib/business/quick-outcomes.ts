import type { LeadStatus } from "@/lib/sample-data";

/**
 * Quick-outcome buttons (spec §10) — pure mapping from a one-tap outcome to the
 * action the call screen should take. Status-changing outcomes resolve to a
 * LeadStatus (driven through the tested validateLeadTransition); the others are
 * UI flows (schedule a follow-up, open convert, flag a data issue).
 */
export type QuickOutcome =
  | "NoAnswer"
  | "Interested"
  | "NotInterested"
  | "CallLater"
  | "WrongNumber"
  | "Converted";

export type QuickOutcomeKind = "status" | "schedule" | "convert" | "flag";

export interface QuickOutcomeDef {
  outcome: QuickOutcome;
  label: string;
  kind: QuickOutcomeKind;
  /** Target status when kind is "status" or "schedule". */
  status?: LeadStatus;
}

export const quickOutcomes: QuickOutcomeDef[] = [
  { outcome: "NoAnswer", label: "No Answer", kind: "status", status: "Attempted Contact (No Response)" },
  { outcome: "Interested", label: "Interested", kind: "status", status: "Contacted (Interested)" },
  { outcome: "NotInterested", label: "Not Interested", kind: "status", status: "Contacted (Not Interested)" },
  { outcome: "CallLater", label: "Call Later", kind: "schedule", status: "Scheduled Follow-Up" },
  { outcome: "WrongNumber", label: "Wrong Number", kind: "flag" },
  { outcome: "Converted", label: "Converted", kind: "convert" },
];

const BY_OUTCOME: Record<QuickOutcome, QuickOutcomeDef> = Object.fromEntries(
  quickOutcomes.map((d) => [d.outcome, d]),
) as Record<QuickOutcome, QuickOutcomeDef>;

export function quickOutcomeDef(outcome: QuickOutcome): QuickOutcomeDef {
  return BY_OUTCOME[outcome];
}

/** The status an outcome maps to (status/schedule kinds), or null for convert/flag. */
export function quickOutcomeStatus(outcome: QuickOutcome): LeadStatus | null {
  return BY_OUTCOME[outcome]?.status ?? null;
}
