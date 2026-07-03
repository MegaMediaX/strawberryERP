/**
 * Lead status-transition guard — CLAUDE_HANDOFF.md §3.
 *
 * The handoff lists the six statuses and the rule that "Scheduled Follow-Up
 * requires a date", but does not specify a transition matrix. The matrix below
 * is a deliberate product decision (recorded in BUILD_STATE.md → Decisions):
 *
 * - A lead may always stay in its current status (idempotent no-op updates).
 * - From "New Lead (Uncontacted)" you may move to any contact-progress state,
 *   so a first call that connects can be logged in one tap (interested,
 *   not-interested, or scheduled follow-up) as well as attempted/awaiting.
 * - Any contacted/attempted/follow-up state may move to any other
 *   contact-progress state (re-engagement is allowed — a "Not Interested" lead
 *   can be revived).
 * - Moving TO "Scheduled Follow-Up" requires a follow_up_date.
 * - There is no transition back to "New Lead (Uncontacted)" once contact begins.
 */

import { leadStatuses, type LeadStatus } from "@/lib/sample-data";

const SCHEDULED = "Scheduled Follow-Up" as const;

const progressStates: LeadStatus[] = [
  "Attempted Contact (No Response)",
  "Contacted (Awaiting Response)",
  "Contacted (Not Interested)",
  "Contacted (Interested)",
  "Scheduled Follow-Up",
];

const allowed: Record<LeadStatus, LeadStatus[]> = {
  "New Lead (Uncontacted)": [
    "Attempted Contact (No Response)",
    "Contacted (Awaiting Response)",
    "Contacted (Interested)",
    "Contacted (Not Interested)",
    "Scheduled Follow-Up",
  ],
  "Attempted Contact (No Response)": progressStates,
  "Contacted (Awaiting Response)": progressStates,
  "Contacted (Not Interested)": progressStates,
  "Contacted (Interested)": progressStates,
  "Scheduled Follow-Up": progressStates,
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (leadStatuses as readonly string[]).includes(value);
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true;
  return allowed[from].includes(to);
}

/**
 * Returns null if the transition is valid, otherwise a human-readable error.
 * `followUpDate` is required when moving to "Scheduled Follow-Up".
 */
export function validateLeadTransition(
  from: string,
  to: string,
  followUpDate?: string,
): string | null {
  if (!isLeadStatus(from)) return `Unknown current status: ${from}`;
  if (!isLeadStatus(to)) return `Unknown target status: ${to}`;

  if (!canTransition(from, to)) {
    return `Cannot move a lead from "${from}" to "${to}".`;
  }

  if (to === SCHEDULED && from !== SCHEDULED && !followUpDate) {
    return "Scheduled Follow-Up requires a follow-up date.";
  }

  return null;
}
