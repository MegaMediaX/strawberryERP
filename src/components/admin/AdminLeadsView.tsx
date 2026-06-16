"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { adminLeadViews, applyAdminLeadView, type AdminLeadView } from "@/lib/admin/admin-leads";
import { distinctValues, filterLeads, sortLeads, type LeadFilters } from "@/lib/sales/lead-filters";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

type Filters = LeadFilters & { reseller?: string; assignedUser?: string };
const actionBtn = "inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

function priorityTone(p: string): "rose" | "amber" | "blue" | "neutral" {
  if (p === "VIP" || p === "High") return "rose";
  if (p === "Medium") return "amber";
  if (p === "Low") return "blue";
  return "neutral";
}

export function AdminLeadsView({ leads, assignees }: { leads: PortalLead[]; assignees: string[] }) {
  const router = useRouter();
  const [view, setView] = useState<AdminLeadView>("all");
  const [filters, setFilters] = useStickyFilters<Filters>("lebtech.admin.leads.filters", {});
  const [busy, setBusy] = useState<string | null>(null);
  const [reassign, setReassign] = useState<PortalLead | null>(null);
  const [target, setTarget] = useState("");

  const resellers = useMemo(() => distinctValues(leads, "reseller"), [leads]);
  const users = useMemo(() => distinctValues(leads, "assignedTo"), [leads]);
  const priorities = useMemo(() => distinctValues(leads, "priority"), [leads]);

  const visible = useMemo(() => {
    const inView = applyAdminLeadView(leads, view, new Date());
    const filtered = filterLeads(inView, filters).filter((l) => (!filters.reseller || l.reseller === filters.reseller) && (!filters.assignedUser || l.assignedTo === filters.assignedUser));
    return sortLeads(filtered, "priority");
  }, [leads, view, filters]);

  function set<K extends keyof Filters>(k: K, v: Filters[K]) { setFilters((p) => ({ ...p, [k]: v || undefined })); }

  async function act(lead: PortalLead, action: "convert" | "archive", confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(lead.id);
    try {
      await fetch("/api/admin/leads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: lead.id, action }) });
      router.refresh();
    } finally { setBusy(null); }
  }
  async function doReassign() {
    if (!reassign || !target) return;
    setBusy(reassign.id);
    try {
      await fetch("/api/admin/leads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: reassign.id, action: "reassign", assignedTo: target }) });
      setReassign(null); setTarget(""); router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Leads</h1>
        <p className="text-sm text-[var(--muted)]">{visible.length} of {leads.length} · all countries · all resellers</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Saved views">
        {adminLeadViews.map((v) => (
          <button key={v.key} role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${view === v.key ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{v.label}</button>
        ))}
      </div>

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Search"><Input aria-label="Search leads" placeholder="Company, contact…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
        <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Assigned"><Select aria-label="Assigned user" value={filters.assignedUser ?? ""} onChange={(e) => set("assignedUser", e.target.value)}><option value="">All</option>{users.map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">All</option>{leadStatuses.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Priority"><Select aria-label="Priority" value={filters.priority ?? ""} onChange={(e) => set("priority", e.target.value)}><option value="">All</option>{priorities.map((p) => <option key={p}>{p}</option>)}</Select></Field>
      </CardContent></Card>

      {visible.length === 0 ? (
        <EmptyState title="No leads found" description="Adjust filters or the saved view." />
      ) : (
        <Card className="hidden md:block"><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Company", "Contact", "Gender", "Country", "Reseller", "Assigned", "Status", "Priority", "Source", "Follow-up", "Last activity", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle font-medium"><Link href={`/admin/leads/${l.id}`} className="text-[var(--brand)] hover:underline">{l.company}</Link></td>
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
                    <div className="flex flex-wrap gap-1.5">
                      <Link href={`/admin/leads/${l.id}`} className={actionBtn}>Open</Link>
                      <button type="button" className={actionBtn} disabled={busy === l.id} onClick={() => { setReassign(l); setTarget(""); }}>Reassign</button>
                      <button type="button" className={actionBtn} disabled={busy === l.id} onClick={() => act(l, "convert")}>Convert</button>
                      <button type="button" className={actionBtn} disabled={busy === l.id} onClick={() => act(l, "archive", `Archive ${l.company}? It moves to the delete queue.`)}>Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {/* Mobile cards */}
      {visible.length > 0 && (
        <div className="grid gap-3 md:hidden">
          {visible.map((l) => (
            <Card key={l.id}><CardContent className="grid gap-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><Link href={`/admin/leads/${l.id}`} className="truncate font-semibold text-[var(--brand)]">{l.company}</Link><p className="truncate text-xs text-[var(--muted)]">{l.country} · {l.reseller} · {l.assignedTo}</p></div>
                <Badge tone={priorityTone(l.priority)}>{l.priority}</Badge>
              </div>
              <p className="text-xs text-[var(--muted)]"><Badge tone="neutral">{l.status}</Badge></p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={actionBtn} onClick={() => { setReassign(l); setTarget(""); }}>Reassign</button>
                <button type="button" className={actionBtn} onClick={() => act(l, "convert")}>Convert</button>
                <button type="button" className={actionBtn} onClick={() => act(l, "archive", `Archive ${l.company}?`)}>Archive</button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      {reassign && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Reassign lead" onClick={(e) => { if (e.target === e.currentTarget) setReassign(null); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <h2 className="text-base font-bold tracking-tight">Reassign {reassign.company}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Assign to"><Select aria-label="Reassign target" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Select user…</option>{assignees.map((a) => <option key={a}>{a}</option>)}</Select></Field>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setReassign(null)}>Cancel</Button>
                <Button className="flex-1" onClick={doReassign} disabled={!target}>Reassign</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
