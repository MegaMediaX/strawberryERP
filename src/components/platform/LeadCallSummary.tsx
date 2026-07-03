import { Phone } from "lucide-react";

import type { CallRecord } from "@/lib/telephony/call-record";

/**
 * Compact call history summary for a single lead ("3 calls · 2 answered ·
 * 4m talk"). Purely presentational — callers pass the lead's CallRecords
 * (getCallRecords() filtered by leadId); the full history stays on the timeline.
 */
export function LeadCallSummary({ calls }: { calls: readonly CallRecord[] }) {
  if (calls.length === 0) return null;
  const answered = calls.filter((c) => c.answered);
  const talkSeconds = answered.reduce((sum, c) => sum + c.talkSeconds, 0);
  const talk = talkSeconds < 60 ? `${talkSeconds}s` : `${Math.round(talkSeconds / 60)}m`;
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <Phone className="size-3.5" />
      {calls.length} call{calls.length === 1 ? "" : "s"} · {answered.length} answered · {talk} talk
    </p>
  );
}
