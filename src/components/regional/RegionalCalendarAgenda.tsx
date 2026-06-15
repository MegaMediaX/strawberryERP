"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, FileText, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import {
  buildRegionalAgenda,
  regionalAgendaCount,
  type AgendaEscalation,
  type AgendaEvent,
  type AgendaEventKind,
  type AgendaInvoice,
  type RegionalAgendaFilters,
} from "@/lib/regional/build-regional-agenda";
import type { PortalLead } from "@/lib/ui-data";

const KIND_ICON: Record<AgendaEventKind, typeof UserRound> = {
  lead: UserRound, invoice: FileText, escalation: AlertTriangle,
};
const KIND_LABEL: Record<AgendaEventKind, string> = {
  lead: "Lead follow-up", invoice: "Invoice due", escalation: "Escalation",
};

function EventRow({ ev }: { ev: AgendaEvent }) {
  const Icon = KIND_ICON[ev.kind];
  return (
    <Link
      href={ev.href}
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition hover:bg-[var(--background)] ${ev.overdue ? "border-rose-300 dark:border-rose-800" : "border-[var(--border)]"}`}
    >
      <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${ev.overdue ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-[var(--background)] text-[var(--muted)]"}`}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{ev.title}</p>
          {ev.overdue && <Badge tone="rose">Overdue</Badge>}
        </div>
        <p className="truncate text-xs text-[var(--muted)]">{ev.meta}</p>
        <p className="truncate text-xs text-[var(--muted)]">{ev.country} · {ev.reseller} · {ev.when}</p>
      </div>
      <span className="shrink-0 self-center text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">{KIND_LABEL[ev.kind]}</span>
    </Link>
  );
}

export function RegionalCalendarAgenda({
  leads,
  invoices,
  escalations,
  scopeLabel,
}: {
  leads: PortalLead[];
  invoices: AgendaInvoice[];
  escalations: AgendaEscalation[];
  scopeLabel: string;
}) {
  const [filters, setFilters] = useState<RegionalAgendaFilters>({});

  const resellers = useMemo(
    () => [...new Set([...leads.map((l) => l.reseller), ...invoices.map((i) => i.reseller), ...escalations.map((e) => e.reseller)])].sort(),
    [leads, invoices, escalations],
  );
  const sections = useMemo(() => buildRegionalAgenda(leads, invoices, escalations, filters, new Date()), [leads, invoices, escalations, filters]);
  const total = useMemo(() => regionalAgendaCount(sections), [sections]);

  function set<K extends keyof RegionalAgendaFilters>(k: K, v: RegionalAgendaFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-[var(--muted)]">{total} events · {scopeLabel} · visibility agenda</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <Field label="Event type"><Select aria-label="Event type" value={filters.kind ?? ""} onChange={(e) => set("kind", (e.target.value || undefined) as AgendaEventKind)}><option value="">All events</option><option value="lead">Lead follow-ups</option><option value="invoice">Invoice due dates</option><option value="escalation">Escalations</option></Select></Field>
          <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <div className="flex items-center"><Badge tone="neutral">Google Calendar · not connected</Badge></div>
        </CardContent>
      </Card>

      {total === 0 ? (
        <EmptyState title="No events in view" description="No follow-ups, invoice due dates, or escalations match your filters. Your region is on track." />
      ) : (
        <div className="grid gap-4">
          {sections.filter((s) => s.items.length > 0).map((s) => (
            <div key={s.bucket} className="grid gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-[var(--muted)]" aria-hidden />
                <h2 className="text-sm font-semibold">{s.label}</h2>
                <span className="text-xs text-[var(--muted)]">{s.items.length}</span>
              </div>
              <div className="grid gap-2">
                {s.items.map((ev) => <EventRow key={ev.id} ev={ev} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
