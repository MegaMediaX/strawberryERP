"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { EscalationButton } from "@/components/regional/EscalationModal";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { applyRegionalLeadView, regionalLeadViews, type RegionalLeadView } from "@/lib/regional/regional-lead-views";
import { distinctValues, filterLeads, sortLeads, type LeadFilters } from "@/lib/sales/lead-filters";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;
function priorityTone(p: string): "rose" | "amber" | "blue" | "neutral" {
  if (p === "VIP" || p === "High") return "rose";
  if (p === "Medium") return "amber";
  if (p === "Low") return "blue";
  return "neutral";
}
const waBtn = "inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white";
const openBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";

type Filters = LeadFilters & { reseller?: string };

export function RegionalLeadsView({
  leads, scopeLabel, initialView = "all", initialFilters = {},
}: {
  leads: PortalLead[];
  scopeLabel: string;
  initialView?: RegionalLeadView;
  initialFilters?: Filters;
}) {
  const [view, setView] = useState<RegionalLeadView>(initialView);
  // A forward-link view intent (e.g. ?followup=overdue) arrives with empty filters; force it so
  // stored filters don't re-narrow the list the dashboard KPI promised.
  const [filters, setFilters] = useStickyFilters<Filters>("lebtech.regional.leads.filters", initialFilters, initialView !== "all");

  const resellers = useMemo(() => distinctValues(leads, "reseller"), [leads]);
  const priorities = useMemo(() => distinctValues(leads, "priority"), [leads]);
  const sources = useMemo(() => distinctValues(leads, "source"), [leads]);

  const visible = useMemo(() => {
    const inView = applyRegionalLeadView(leads, view, new Date());
    const filtered = filterLeads(inView, filters).filter((l) => !filters.reseller || l.reseller === filters.reseller);
    return sortLeads(filtered, "priority");
  }, [leads, view, filters]);

  function set<K extends keyof Filters>(k: K, v: Filters[K]) { setFilters((p) => ({ ...p, [k]: v || undefined })); }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {leads.length} · {scopeLabel} · monitor view</p>
        </div>
        <Link href="/regional/escalations" className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--background)]">View escalations</Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Saved views">
        {regionalLeadViews.map((v) => (
          <button key={v.key} role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${view === v.key ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{v.label}</button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search"><Input aria-label="Search leads" placeholder="Company, contact…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
          <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">All</option>{leadStatuses.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Priority"><Select aria-label="Priority" value={filters.priority ?? ""} onChange={(e) => set("priority", e.target.value)}><option value="">All</option>{priorities.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Source"><Select aria-label="Source" value={filters.source ?? ""} onChange={(e) => set("source", e.target.value)}><option value="">All</option>{sources.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState title="No leads found" description={leads.length === 0 ? "No leads in your region yet." : "Adjust your filters or saved view to see more leads."} />
      ) : (
        <>
          {/* Mobile cards — always show reseller + country */}
          <div className="grid gap-3 md:hidden">
            {visible.map((l) => (
              <Card key={l.id}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/regional/leads/${l.id}`} className="truncate font-semibold text-[var(--brand)]">{l.company}</Link>
                      <p className="truncate text-xs text-[var(--muted)]">{l.contact} · {l.gender}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{l.country} · {l.reseller}</p>
                    </div>
                    <Badge tone={priorityTone(l.priority)}>{l.priority}</Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]"><Badge tone="neutral">{l.status}</Badge>{l.followUp ? ` · ${l.followUp}` : ""}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a href={wa(l.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                    <Link href={`/regional/leads/${l.id}`} className={openBtn}>Open</Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {["Company", "Contact", "Gender", "Country", "Reseller", "Assigned", "Status", "Priority", "Source", "Follow-up", "Last activity", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 align-middle font-medium"><Link href={`/regional/leads/${l.id}`} className="text-[var(--brand)] hover:underline">{l.company}</Link></td>
                      <td className="py-3 pr-4 align-middle">{l.contact}</td>
                      <td className="py-3 pr-4 align-middle">{l.gender}</td>
                      <td className="py-3 pr-4 align-middle">{l.country}</td>
                      <td className="py-3 pr-4 align-middle">{l.reseller}</td>
                      <td className="py-3 pr-4 align-middle">{l.assignedTo}</td>
                      <td className="py-3 pr-4 align-middle"><Badge tone="neutral">{l.status}</Badge></td>
                      <td className="py-3 pr-4 align-middle"><Badge tone={priorityTone(l.priority)}>{l.priority}</Badge></td>
                      <td className="py-3 pr-4 align-middle">{l.source}</td>
                      <td className="py-3 pr-4 align-middle">{l.followUp || "—"}</td>
                      <td className="py-3 pr-4 align-middle text-[var(--muted)]">—</td>
                      <td className="py-3 pr-4 align-middle">
                        <div className="flex gap-2">
                          <Link href={`/regional/leads/${l.id}`} className={openBtn}>Open</Link>
                          <a href={wa(l.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                          <EscalationButton
                            compact
                            context={{ entityType: "Lead", entityId: l.id, entityLabel: l.company, country: l.country, reseller: l.reseller }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-[var(--muted)]">Read-only monitor view — every lead shows its reseller + country. Escalate flags risk to the reseller/Super Admin without taking ownership; reassign and transfer stay with the reseller.</p>
        </>
      )}
    </div>
  );
}
