import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AgendaSection } from "@/lib/sales/build-agenda";

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

export function SalesCalendarAgenda({ sections }: { sections: AgendaSection[] }) {
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-[var(--muted)]">Your agenda, synced from your follow-ups.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <Badge tone="amber">Google Calendar: not connected</Badge>
          <Link href="/sales/profile" className="text-sm font-semibold text-[var(--brand)]">Connect in profile →</Link>
        </CardContent>
      </Card>

      {total === 0 ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">No scheduled follow-ups. Schedule one from a lead to see it here.</p></CardContent></Card>
      ) : (
        sections.map((section) => (
          <section key={section.bucket} className="grid gap-2" aria-label={section.label}>
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-sm font-bold">{section.label}</h2>
              <span className="rounded-full bg-[var(--background)] px-2 text-[11px] font-semibold text-[var(--muted)]">{section.items.length}</span>
            </div>
            {section.items.length === 0 ? (
              <p className="px-1 text-xs text-[var(--muted)]">No {section.label.toLowerCase()} follow-ups.</p>
            ) : (
              section.items.map((lead) => (
                <Card key={lead.id} className={section.bucket === "Overdue" ? "border-rose-300 dark:border-rose-900/60" : undefined}>
                  <CardContent className="grid gap-3 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{lead.company}</p>
                        <p className="truncate text-sm text-[var(--muted)]">{lead.contact} · {lead.followUp || "Unscheduled"}</p>
                      </div>
                      <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <a href={tel(lead.phone)} className={callBtn}>Call</a>
                      <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                      <Link href={`/sales/leads/${lead.id}`} className={openBtn}>Open</Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        ))
      )}
    </div>
  );
}
