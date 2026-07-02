import type { CallRecord } from "@/lib/telephony/call-record";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Activity timeline (spec §12) derived from a lead's facts. Pure +
 * unit-testable. Most-recent-first: calls → current status → follow-up →
 * assignment → source → created. Graceful when fields are empty.
 */
export type TimelineIcon = "status" | "calendar" | "user" | "inbox" | "plus";

export interface TimelineEntry {
  icon: TimelineIcon;
  label: string;
  detail?: string;
}

/** Fields a timeline needs from a logged call (ADR 0001, Phase 1). */
export type CallTimelineInput = Pick<
  CallRecord,
  "direction" | "outcome" | "answered" | "talkSeconds" | "ringSeconds" | "startedAt"
>;

/**
 * Map logged calls to timeline entries, most-recent-first. Answered calls show
 * talk time; no-answer calls show ring time. Pure + unit-tested.
 */
export function callTimelineEntries(calls: readonly CallTimelineInput[]): TimelineEntry[] {
  return [...calls]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .map((c) => {
      const dir = c.direction === "outbound" ? "Outbound call" : "Inbound call";
      const outcome = c.answered ? "answered" : "no answer";
      const secs = c.answered ? `talk ${c.talkSeconds}s` : `rang ${c.ringSeconds}s`;
      const when = c.startedAt.slice(0, 10);
      return { icon: "inbox" as const, label: `${dir} — ${outcome}`, detail: `${secs} · ${when}` };
    });
}

export function buildTimeline(lead: PortalLead, calls: readonly CallTimelineInput[] = []): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  entries.push(...callTimelineEntries(calls));
  entries.push({ icon: "status", label: "Current status", detail: lead.status });
  if (lead.followUp?.trim()) {
    entries.push({ icon: "calendar", label: "Follow-up scheduled", detail: lead.followUp });
  }
  if (lead.assignedTo?.trim()) {
    entries.push({ icon: "user", label: "Assigned to", detail: lead.assignedTo });
  }
  if (lead.source?.trim()) {
    entries.push({ icon: "inbox", label: "Source", detail: lead.source });
  }
  entries.push({ icon: "plus", label: "Lead created", detail: lead.id });
  return entries;
}
