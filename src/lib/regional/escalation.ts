import type { TimelineEntry } from "@/lib/sales/timeline-builder";

/**
 * Escalation flow (spec §16). Pure + unit-testable. The Regional Director can
 * flag a risk to the Reseller Admin / Super Admin WITHOUT taking ownership of
 * the record. Hooks-only in this environment: an escalation becomes a dev-store
 * record + an audit/timeline entry + an in-app notification — never a live
 * WhatsApp/email send. `now` is injected for deterministic tests.
 */

export type EscalationReason =
  | "vip-overdue"
  | "interested-ignored"
  | "invoice-overdue"
  | "contract-stuck"
  | "reseller-inactive"
  | "whatsapp-failure";

export type EscalationTarget = "Reseller Admin" | "Super Admin";

export type EscalationEntity = "Lead" | "Invoice" | "Customer" | "Reseller";

export interface EscalationReasonOption {
  key: EscalationReason;
  label: string;
  /** Entities this reason is normally raised against (UI hint, not enforced). */
  appliesTo: EscalationEntity[];
}

/** The six §16 escalation cases, in priority order. */
export const escalationReasons: readonly EscalationReasonOption[] = [
  { key: "vip-overdue", label: "VIP lead overdue", appliesTo: ["Lead"] },
  { key: "interested-ignored", label: "Interested lead ignored", appliesTo: ["Lead"] },
  { key: "invoice-overdue", label: "Invoice overdue", appliesTo: ["Invoice"] },
  { key: "contract-stuck", label: "Contract stuck", appliesTo: ["Customer", "Lead"] },
  { key: "reseller-inactive", label: "Reseller inactive", appliesTo: ["Reseller"] },
  { key: "whatsapp-failure", label: "WhatsApp delivery failure", appliesTo: ["Lead", "Customer"] },
] as const;

const REASON_LABEL: Record<EscalationReason, string> = Object.fromEntries(
  escalationReasons.map((r) => [r.key, r.label]),
) as Record<EscalationReason, string>;

export function escalationReasonLabel(reason: EscalationReason): string {
  return REASON_LABEL[reason] ?? reason;
}

export const NOTE_MAX = 500;

export interface EscalationInput {
  entityType: EscalationEntity;
  entityId: string;
  entityLabel: string;
  country: string;
  reseller: string;
  reason: EscalationReason;
  note: string;
  notify: EscalationTarget[];
  raisedBy: string;
}

export interface EscalationRecord extends EscalationInput {
  id: string;
  createdAt: string;
}

/** Returns an error string if the escalation is invalid, otherwise null. */
export function validateEscalation(input: Partial<EscalationInput>): string | null {
  if (!input.entityId) return "Nothing selected to escalate.";
  if (!input.reseller || !input.country) return "Escalations must carry country + reseller ownership.";
  if (!input.reason || !REASON_LABEL[input.reason as EscalationReason]) return "Choose an escalation reason.";
  if (!input.notify || input.notify.length === 0) return "Choose who to notify.";
  if ((input.note ?? "").length > NOTE_MAX) return `Note must be ${NOTE_MAX} characters or fewer.`;
  return null;
}

/** Build the persisted record from a validated input. Caller must validate first. */
export function buildEscalationRecord(input: EscalationInput, now: Date): EscalationRecord {
  return {
    ...input,
    note: input.note.trim(),
    id: `ESC-${now.getTime()}`,
    createdAt: now.toISOString(),
  };
}

/** Human label for the audit trail ("Escalated · VIP lead overdue → Super Admin"). */
export function escalationAuditLabel(record: EscalationRecord): string {
  return `${escalationReasonLabel(record.reason)} → ${record.notify.join(", ")}`;
}

/**
 * Timeline entries (most-recent-first) for the escalations raised against one
 * record, merged into the §15 lead-detail timeline.
 */
export function escalationTimelineEntries(escalations: readonly EscalationRecord[]): TimelineEntry[] {
  return [...escalations]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({
      icon: "status",
      label: `Escalated · ${escalationReasonLabel(e.reason)}`,
      detail: e.note ? `${e.notify.join(", ")} · ${e.note}` : `Notified ${e.notify.join(", ")}`,
    }));
}
