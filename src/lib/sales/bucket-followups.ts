/**
 * Follow-up queue bucketing (spec §13). PortalLead.followUp is a HUMAN string
 * ("Today, 16:30", "Tomorrow, 10:00", "Jun 10, 12:00", "Unscheduled"), not an
 * ISO date. This classifies each string into a queue bucket. PURE: `now` is
 * injected (no Date.now() inside) so it is fully unit-testable.
 */

export type FollowUpBucket = "Today" | "Overdue" | "Tomorrow" | "This Week" | "Unscheduled";

export type FollowUpTab = "Today" | "Overdue" | "Tomorrow" | "This Week" | "All";
export const followUpTabs: readonly FollowUpTab[] = ["Today", "Overdue", "Tomorrow", "This Week", "All"];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const MS_PER_DAY = 86_400_000;

export function bucketFollowUp(followUp: string, now: Date): FollowUpBucket {
  const s = (followUp || "").trim().toLowerCase();
  if (!s || s === "unscheduled") return "Unscheduled";
  if (s.startsWith("today")) return "Today";
  if (s.startsWith("tomorrow")) return "Tomorrow";

  const m = s.match(/^([a-z]{3,})\s+(\d{1,2})/);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3)];
    const day = Number(m[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(now.getFullYear(), month, day);
      const diffDays = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
      if (diffDays < 0) return "Overdue";
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      if (diffDays <= 7) return "This Week";
      return "Unscheduled"; // further out — only appears under "All"
    }
  }
  return "Unscheduled";
}

/** Whether a lead's bucket belongs under the given tab. "All" matches everything. */
export function inTab(bucket: FollowUpBucket, tab: FollowUpTab): boolean {
  if (tab === "All") return true;
  if (tab === "This Week") return bucket === "Today" || bucket === "Tomorrow" || bucket === "This Week";
  return bucket === tab;
}
