"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { bucketFollowUp, followUpTabs, inTab, type FollowUpTab } from "@/lib/sales/bucket-followups";
import { priorityRank } from "@/lib/sales/lead-filters";
import { parseNotes } from "@/lib/sales/notes-formatter";
import { cn } from "@/lib/utils";
import type { PortalLead } from "@/lib/ui-data";

const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;

function priorityTone(p: string): "rose" | "amber" | "blue" | "neutral" {
  if (p === "VIP" || p === "High") return "rose";
  if (p === "Medium") return "amber";
  if (p === "Low") return "blue";
  return "neutral";
}

const callBtn = "inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white";
const waBtn = "inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white";
const openBtn = "inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";

const EMPTY: Record<FollowUpTab, string> = {
  Today: "You have no follow-ups today. Great job staying on top of your pipeline.",
  Overdue: "Nothing overdue — you're all caught up.",
  Tomorrow: "No follow-ups scheduled for tomorrow yet.",
  "This Week": "No follow-ups this week.",
  All: "No leads assigned yet. Once leads are assigned to you, they will appear here.",
};

export function SalesFollowUpsView({ leads }: { leads: PortalLead[] }) {
  const [tab, setTab] = useState<FollowUpTab>("Today");
  // Compute the bucket once per lead (client clock); pure fn keeps it testable elsewhere.
  const now = useMemo(() => new Date(), []);
  const withBucket = useMemo(
    () => leads.map((lead) => ({ lead, bucket: bucketFollowUp(lead.followUp, now) })),
    [leads, now],
  );
  const counts = useMemo(() => {
    const c = {} as Record<FollowUpTab, number>;
    for (const t of followUpTabs) c[t] = withBucket.filter((w) => inTab(w.bucket, t)).length;
    return c;
  }, [withBucket]);

  const visible = useMemo(
    () =>
      withBucket
        .filter((w) => inTab(w.bucket, tab))
        .sort((a, b) => priorityRank(a.lead.priority) - priorityRank(b.lead.priority)),
    [withBucket, tab],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-[var(--muted)]">Your daily work queue, most urgent first.</p>
        </div>
        <Link href="/sales/calendar" className="text-sm font-semibold text-[var(--brand)]">Calendar view →</Link>
      </div>

      {/* Tabs — horizontally scrollable on mobile */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {followUpTabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
              tab === t ? "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]",
            )}
          >
            {t}
            <span className={cn("rounded-full px-1.5 text-[11px]", tab === t ? "bg-white/25" : "bg-[var(--background)]")}>{counts[t]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">{EMPTY[tab]}</p></CardContent></Card>
      ) : (
        <div className="grid gap-3" aria-label="Follow-ups">
          {visible.map(({ lead, bucket }) => {
            const lastNote = parseNotes(lead.notes)[0];
            const overdue = bucket === "Overdue";
            return (
              <Card key={lead.id} className={cn(overdue && "border-rose-300 dark:border-rose-900/60")}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{lead.company}</p>
                      <p className="truncate text-sm text-[var(--muted)]">{lead.contact} · {lead.phone}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                      {overdue ? <Badge tone="rose">Overdue</Badge> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <Badge tone="neutral">{lead.status}</Badge>
                    <span>· {lead.followUp || "Unscheduled"}</span>
                  </div>
                  {lastNote ? <p className="truncate rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">{lastNote}</p> : null}
                  <div className="flex gap-2">
                    <a href={tel(lead.phone)} className={callBtn}>Call</a>
                    <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                    <Link href={`/sales/leads/${lead.id}`} className={openBtn}>Open</Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
