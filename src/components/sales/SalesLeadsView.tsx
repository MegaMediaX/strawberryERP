"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { distinctValues, filterLeads, sortLeads, type LeadFilters } from "@/lib/sales/lead-filters";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const wa = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}`;

function priorityTone(p: string): "rose" | "amber" | "blue" | "neutral" {
  if (p === "VIP" || p === "High") return "rose";
  if (p === "Medium") return "amber";
  if (p === "Low") return "blue";
  return "neutral";
}

const callBtn = "inline-flex h-9 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white";
const waBtn = "inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white";
const openBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";

export function SalesLeadsView({ leads }: { leads: PortalLead[] }) {
  const [filters, setFilters] = useState<LeadFilters>({});
  const priorities = useMemo(() => distinctValues(leads, "priority"), [leads]);
  const sources = useMemo(() => distinctValues(leads, "source"), [leads]);
  const countries = useMemo(() => distinctValues(leads, "country"), [leads]);

  const visible = useMemo(() => sortLeads(filterLeads(leads, filters), "priority"), [leads, filters]);
  const activeCount = Object.values(filters).filter((v) => v && String(v).trim()).length;

  function set<K extends keyof LeadFilters>(k: K, v: LeadFilters[K]) {
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My leads</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {leads.length} · assigned to you</p>
        </div>
        <Link href="/sales/leads/new" className="hidden h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)] sm:inline-flex">
          <Plus className="size-4" /> New lead
        </Link>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search"><Input aria-label="Search leads" placeholder="Company, contact, ID…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
          <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">All</option>{leadStatuses.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Priority"><Select aria-label="Priority" value={filters.priority ?? ""} onChange={(e) => set("priority", e.target.value)}><option value="">All</option>{priorities.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Source"><Select aria-label="Source" value={filters.source ?? ""} onChange={(e) => set("source", e.target.value)}><option value="">All</option>{sources.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          {activeCount > 0 ? (
            <div className="sm:col-span-2 lg:col-span-5">
              <button onClick={() => setFilters({})} className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--background)]">
                Reset filters ({activeCount})
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card><CardHeader><CardTitle>No leads found</CardTitle></CardHeader><CardContent><p className="text-sm text-[var(--muted)]">{leads.length === 0 ? "No leads assigned yet. Once leads are assigned to you, they will appear here." : "Adjust your filters to see more leads."}</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden" aria-label="Leads">
            {visible.map((lead) => (
              <Card key={lead.id}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{lead.company}</p>
                      <p className="truncate text-sm text-[var(--muted)]">{lead.contact}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <Badge tone="neutral">{lead.status}</Badge>
                    {lead.followUp ? <span>· Follow-up {lead.followUp}</span> : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <a href={tel(lead.phone)} className={callBtn}>Call</a>
                    <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                    <Link href={`/sales/leads/${lead.id}`} className={openBtn}>Open</Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Company</th>
                    <th className="py-3 pr-4 font-semibold">Contact</th>
                    <th className="py-3 pr-4 font-semibold">Phone</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Priority</th>
                    <th className="py-3 pr-4 font-semibold">Follow-up</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => (
                    <tr key={lead.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium">{lead.company}</td>
                      <td className="py-3.5 pr-4 align-middle">{lead.contact}</td>
                      <td className="py-3.5 pr-4 align-middle">{lead.phone}</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone="neutral">{lead.status}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle">{lead.followUp || "—"}</td>
                      <td className="py-3.5 pr-4 align-middle">
                        <div className="flex gap-2">
                          <a href={tel(lead.phone)} className={callBtn}>Call</a>
                          <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                          <Link href={`/sales/leads/${lead.id}`} className={openBtn}>Open</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Mobile FAB (spec §24) */}
      <Link href="/sales/leads/new" aria-label="Add lead" className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-[var(--shadow-md)] sm:hidden">
        <Plus className="size-6" />
      </Link>
    </div>
  );
}
