"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { agendaCount, buildTeamAgenda } from "@/lib/reseller/build-team-agenda";
import type { PortalLead } from "@/lib/ui-data";

const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;

function priorityTone(p: string): "rose" | "amber" | "blue" | "neutral" {
  if (p === "VIP" || p === "High") return "rose";
  if (p === "Medium") return "amber";
  if (p === "Low") return "blue";
  return "neutral";
}

const waBtn = "inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white";
const openBtn = "inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";

export function ResellerTeamAgenda({
  leads, now, assignees, countries, priorities, resellerName,
}: {
  leads: PortalLead[];
  now: string;
  assignees: string[];
  countries: string[];
  priorities: string[];
  resellerName: string;
}) {
  const [salesperson, setSalesperson] = useState("");
  const [country, setCountry] = useState("");
  const [priority, setPriority] = useState("");

  const sections = useMemo(
    () => buildTeamAgenda(leads, { salesperson: salesperson || undefined, country: country || undefined, priority: priority || undefined }, new Date(now)),
    [leads, salesperson, country, priority, now],
  );
  const total = agendaCount(sections);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-[var(--muted)]">Team follow-ups across {resellerName}, from lead follow-up dates.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          <Badge tone="amber">Google Calendar: not connected</Badge>
          <span className="text-xs text-[var(--muted)]">Follow-ups are tracked in-app only.</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
          <Field label="Salesperson"><Select aria-label="Salesperson" value={salesperson} onChange={(e) => setSalesperson(e.target.value)}><option value="">All</option>{assignees.map((a) => <option key={a}>{a}</option>)}</Select></Field>
          <Field label="Country"><Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Priority"><Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All</option>{priorities.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        </CardContent>
      </Card>

      {total === 0 ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">No follow-ups in this view. Adjust the filters or schedule one from a lead.</p></CardContent></Card>
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
                        <p className="truncate text-xs text-[var(--muted)]">{lead.country} · assigned to {lead.assignedTo}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                        {section.bucket === "Overdue" ? <Badge tone="rose" className="animate-pulse">Urgent</Badge> : null}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                      <Link href={`/reseller/leads/${lead.id}`} className={openBtn}>Open lead</Link>
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
