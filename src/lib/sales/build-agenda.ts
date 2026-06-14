import { bucketFollowUp, type FollowUpBucket } from "@/lib/sales/bucket-followups";
import { priorityRank } from "@/lib/sales/lead-filters";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Calendar agenda (spec §21) — derived from lead follow-up dates (hooks-only).
 * Groups the user's already-scoped leads into day-buckets and sorts each by
 * priority. PURE: `now` injected for deterministic tests.
 */
export interface AgendaSection {
  bucket: FollowUpBucket;
  label: string;
  items: PortalLead[];
}

// Display order + human label for each bucket.
const SECTIONS: { bucket: FollowUpBucket; label: string }[] = [
  { bucket: "Overdue", label: "Overdue" },
  { bucket: "Today", label: "Today" },
  { bucket: "Tomorrow", label: "Tomorrow" },
  { bucket: "This Week", label: "This week" },
  { bucket: "Unscheduled", label: "Later / unscheduled" },
];

export function buildAgenda(leads: readonly PortalLead[], now: Date): AgendaSection[] {
  const byBucket = new Map<FollowUpBucket, PortalLead[]>();
  for (const lead of leads) {
    const b = bucketFollowUp(lead.followUp, now);
    const list = byBucket.get(b) ?? [];
    list.push(lead);
    byBucket.set(b, list);
  }
  return SECTIONS.map(({ bucket, label }) => ({
    bucket,
    label,
    items: (byBucket.get(bucket) ?? []).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
  }));
}
