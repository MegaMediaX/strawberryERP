import type { PortalLead } from "@/lib/ui-data";

/**
 * Activity timeline (spec §12) derived from a lead's facts. Pure +
 * unit-testable. Most-recent-first: current status → follow-up → assignment →
 * source → created. Graceful when fields are empty.
 */
export type TimelineIcon = "status" | "calendar" | "user" | "inbox" | "plus";

export interface TimelineEntry {
  icon: TimelineIcon;
  label: string;
  detail?: string;
}

export function buildTimeline(lead: PortalLead): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
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
