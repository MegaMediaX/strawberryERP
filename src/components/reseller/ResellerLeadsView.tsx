"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { eligibleAssignees, validateReassignment } from "@/lib/business/lead-reassignment";
import type { PortalUser } from "@/lib/portal-security";
import { applySavedView, savedViews, type SavedViewKey } from "@/lib/reseller/saved-views";
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
const reassignBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--background)]";

type Props = {
  leads: PortalLead[];
  teamUsers: PortalUser[];
  actingUser: PortalUser;
  resellerName: string;
};

export function ResellerLeadsView({ leads: initialLeads, teamUsers, actingUser, resellerName }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [view, setView] = useState<SavedViewKey>("active");
  const [filters, setFilters] = useState<LeadFilters & { assignedUser?: string }>({});
  const [reassignTarget, setReassignTarget] = useState<PortalLead | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const priorities = useMemo(() => distinctValues(leads, "priority"), [leads]);
  const sources = useMemo(() => distinctValues(leads, "source"), [leads]);
  const countries = useMemo(() => distinctValues(leads, "country"), [leads]);
  const assignees = useMemo(() => distinctValues(leads, "assignedTo"), [leads]);

  const visible = useMemo(() => {
    const inView = applySavedView(leads, view, new Date());
    const filtered = filterLeads(inView, filters).filter(
      (l) => !filters.assignedUser || l.assignedTo === filters.assignedUser,
    );
    return sortLeads(filtered, "priority");
  }, [leads, view, filters]);

  const activeCount = Object.values(filters).filter((v) => v && String(v).trim()).length;

  function set<K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));
  }

  /** Workload (active-lead count in current scope) per assignee name — helps balance reassignment. */
  const workload = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) map.set(l.assignedTo, (map.get(l.assignedTo) ?? 0) + 1);
    return map;
  }, [leads]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {leads.length} · {resellerName}</p>
        </div>
        <Link href="/reseller/leads/new" className="hidden h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)] sm:inline-flex">
          <Plus className="size-4" /> Add lead
        </Link>
      </div>

      {/* Saved-view pills (spec §8) */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Saved views">
        {savedViews.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${
              view === v.key
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Search"><Input aria-label="Search leads" placeholder="Company, contact, ID…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
          <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Assigned user"><Select aria-label="Assigned user" value={filters.assignedUser ?? ""} onChange={(e) => set("assignedUser", e.target.value)}><option value="">All</option>{assignees.map((a) => <option key={a}>{a}</option>)}</Select></Field>
          <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">All</option>{leadStatuses.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Priority"><Select aria-label="Priority" value={filters.priority ?? ""} onChange={(e) => set("priority", e.target.value)}><option value="">All</option>{priorities.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Source"><Select aria-label="Source" value={filters.source ?? ""} onChange={(e) => set("source", e.target.value)}><option value="">All</option>{sources.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          {activeCount > 0 ? (
            <div className="sm:col-span-2 lg:col-span-6">
              <button onClick={() => setFilters({})} className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--background)]">
                Reset filters ({activeCount})
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card><CardHeader><CardTitle>No leads found</CardTitle></CardHeader><CardContent><p className="text-sm text-[var(--muted)]">{leads.length === 0 ? "No leads under your reseller yet. Add a lead or import a CSV to get started." : "Adjust your filters or saved view to see more leads."}</p></CardContent></Card>
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
                      <p className="truncate text-sm text-[var(--muted)]">{lead.contact} · {lead.gender}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{lead.country} · {lead.assignedTo}</p>
                    </div>
                    <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <Badge tone="neutral">{lead.status}</Badge>
                    {lead.followUp ? <span>· {lead.followUp}</span> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a href={tel(lead.phone)} className={callBtn}>Call</a>
                    <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                    <Link href={`/reseller/leads/${lead.id}`} className={openBtn}>Open</Link>
                    <button onClick={() => setReassignTarget(lead)} className={reassignBtn}>Reassign</button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Company</th>
                    <th className="py-3 pr-4 font-semibold">Contact</th>
                    <th className="py-3 pr-4 font-semibold">Country</th>
                    <th className="py-3 pr-4 font-semibold">Assigned</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Priority</th>
                    <th className="py-3 pr-4 font-semibold">Source</th>
                    <th className="py-3 pr-4 font-semibold">Follow-up</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => (
                    <tr key={lead.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium">{lead.company}</td>
                      <td className="py-3.5 pr-4 align-middle">{lead.contact}<span className="block text-xs text-[var(--muted)]">{lead.gender} · {lead.phone}</span></td>
                      <td className="py-3.5 pr-4 align-middle">{lead.country}</td>
                      <td className="py-3.5 pr-4 align-middle">{lead.assignedTo}</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone="neutral">{lead.status}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle">{lead.source}</td>
                      <td className="py-3.5 pr-4 align-middle">{lead.followUp || "—"}</td>
                      <td className="py-3.5 pr-4 align-middle">
                        <div className="flex gap-2">
                          <a href={tel(lead.phone)} className={callBtn}>Call</a>
                          <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>
                          <Link href={`/reseller/leads/${lead.id}`} className={openBtn}>Open</Link>
                          <button onClick={() => setReassignTarget(lead)} className={reassignBtn}>Reassign</button>
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

      {reassignTarget ? (
        <ReassignModal
          lead={reassignTarget}
          teamUsers={teamUsers}
          actingUser={actingUser}
          workload={workload}
          onClose={() => setReassignTarget(null)}
          onReassigned={(name) => {
            setLeads((prev) => prev.map((l) => (l.id === reassignTarget.id ? { ...l, assignedTo: name } : l)));
            setToast(`${reassignTarget.company} reassigned to ${name}.`);
            setReassignTarget(null);
            window.setTimeout(() => setToast(null), 4000);
          }}
        />
      ) : null}

      {toast ? (
        <div role="status" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] shadow-[var(--shadow-md)] md:bottom-6">
          {toast}
        </div>
      ) : null}

      <Link href="/reseller/leads/new" aria-label="Add lead" className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-[var(--shadow-md)] sm:hidden">
        <Plus className="size-6" />
      </Link>
    </div>
  );
}

function ReassignModal({
  lead, teamUsers, actingUser, workload, onClose, onReassigned,
}: {
  lead: PortalLead;
  teamUsers: PortalUser[];
  actingUser: PortalUser;
  workload: Map<string, number>;
  onClose: () => void;
  onReassigned: (name: string) => void;
}) {
  const candidates = useMemo(() => eligibleAssignees(lead, actingUser, teamUsers), [lead, actingUser, teamUsers]);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const validation = validateReassignment(lead, target, actingUser, teamUsers);
    if (validation) { setError(validation); return; }
    setBusy(true);
    setError(null);
    const chosen = teamUsers.find((u) => u.id === target);
    try {
      const res = await fetch("/api/frappe/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-platform-user-id": actingUser.id },
        body: JSON.stringify({ id: lead.id, assignedUser: chosen?.name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Reassignment failed. Try again.");
        setBusy(false);
        return;
      }
      onReassigned(chosen?.name ?? "");
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-[var(--card)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Reassign lead</h2>
            <p className="text-sm text-[var(--muted)]">{lead.company} · currently {lead.assignedTo}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--background)]"><X className="size-5" /></button>
        </div>

        {candidates.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No eligible team members for this lead&apos;s country.</p>
        ) : (
          <div className="grid gap-2" role="radiogroup" aria-label="Team members">
            {candidates.map((u) => (
              <button
                key={u.id}
                role="radio"
                aria-checked={target === u.id}
                onClick={() => setTarget(u.id)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  target === u.id ? "border-[var(--brand)] bg-[var(--brand)]/5" : "border-[var(--border)] hover:bg-[var(--background)]"
                }`}
              >
                <span><span className="font-semibold">{u.name}</span><span className="block text-xs text-[var(--muted)]">{u.countries.join(", ")}</span></span>
                <Badge tone="neutral">{workload.get(u.name) ?? 0} leads</Badge>
              </button>
            ))}
          </div>
        )}

        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            disabled
            title="Needs Super Admin permission per reseller"
            className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--muted)] opacity-60"
          >
            Transfer
          </button>
          <button
            onClick={submit}
            disabled={busy || candidates.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {busy ? "Reassigning…" : "Reassign"}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">Transfer to another reseller needs Super Admin permission.</p>
      </div>
    </div>
  );
}
