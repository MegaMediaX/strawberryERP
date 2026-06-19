"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleSlash, Clock, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { STATUS_META, type SlotStatus } from "@/lib/admin/slot-status";
import type { FloorPlanData, FloorPlanSlot } from "@/lib/admin/floor-plan";

const ICON: Record<SlotStatus, typeof Clock> = { Available: CircleCheck, OnHold: Clock, Reserved: Lock, Inactive: CircleSlash };
const BG: Record<SlotStatus, string> = {
  Available: "bg-emerald-500 text-white",
  OnHold: "bg-amber-500 text-white",
  Reserved: "bg-rose-500 text-white",
  Inactive: "bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};
const DOT: Record<SlotStatus, string> = { Available: "bg-emerald-500", OnHold: "bg-amber-500", Reserved: "bg-rose-500", Inactive: "bg-slate-400" };

const money = (n: number) => `$${n.toLocaleString()}`;

/** Plain calendar time until the (already working-hours-correct) expiry instant. */
function countdown(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "expiring…";
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return d > 0 ? `${d}d ${h}h left` : `${h}h ${m}m left`;
}

export function FloorPlanMap({ data, role, actor, isAdmin }: { data: FloorPlanData; role: string; actor: string; isAdmin: boolean }) {
  const router = useRouter();
  const [filters, setFilters] = useStickyFilters<{ status?: SlotStatus; zone?: string }>("lebtech.floorplan.filters", {});
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState("");
  // Tick once a minute so the working-hours countdown stays live, not frozen at mount.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const isReseller = role === "Reseller Admin" || role === "Sales Team User";

  const visibleSlots = useMemo(
    () => data.slots.filter((s) => (!filters.status || s.status === filters.status) && (!filters.zone || s.zoneId === filters.zone)),
    [data.slots, filters],
  );
  const byZone = useMemo(() => {
    const m = new Map<string, FloorPlanSlot[]>();
    for (const s of visibleSlots) { const a = m.get(s.zoneId) ?? []; a.push(s); m.set(s.zoneId, a); }
    return m;
  }, [visibleSlots]);
  const sel = selected ? data.slots.find((s) => s.label === selected) : null;

  async function act(label: string, action: string, admin: boolean) {
    setErr(""); setBusy(`${label}:${action}`);
    try {
      const res = admin
        ? await fetch("/api/admin/slots/status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, action }) })
        : await fetch("/api/slots/hold", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, action }) });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(d.error ?? "Action failed."); return; }
      setSelected(null); // the slot's available actions changed — close the stale panel
      router.refresh();
    } finally { setBusy(null); }
  }

  function actionsFor(s: FloorPlanSlot): { action: string; label: string; admin: boolean }[] {
    if (isAdmin) {
      if (s.status === "OnHold") return [{ action: "approve", label: "Approve", admin: true }, { action: "reject", label: "Reject", admin: true }];
      if (s.status === "Reserved") return [{ action: "release", label: "Release", admin: true }];
      return [];
    }
    if (isReseller) {
      if (s.status === "Available") return [{ action: "requestHold", label: "Request hold", admin: false }];
      if (s.status === "OnHold" && s.heldBy === actor) return [{ action: "cancel", label: "Cancel hold", admin: false }];
    }
    return [];
  }

  return (
    <div className="grid gap-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        {(["Available", "OnHold", "Reserved", "Inactive"] as const).map((st) => {
          const Icon = ICON[st];
          return <span key={st} className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${DOT[st]}`} /><Icon className="size-3.5" />{STATUS_META[st].label}</span>;
        })}
      </div>

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
        <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => setFilters((p) => ({ ...p, status: (e.target.value || undefined) as SlotStatus }))}><option value="">All</option><option value="Available">Available</option><option value="OnHold">On Hold</option><option value="Reserved">Reserved</option><option value="Inactive">Inactive</option></Select></Field>
        <Field label="Zone"><Select aria-label="Zone" value={filters.zone ?? ""} onChange={(e) => setFilters((p) => ({ ...p, zone: e.target.value || undefined }))}><option value="">All</option>{data.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select></Field>
      </CardContent></Card>

      {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}

      {/* Map */}
      <div className="grid gap-4">
        {data.zones.map((z) => {
          const slots = byZone.get(z.id) ?? [];
          if (filters.zone && filters.zone !== z.id) return null;
          return (
            <Card key={z.id}><CardHeader className="pb-2"><CardTitle className="text-base">{z.name}</CardTitle></CardHeader>
              <CardContent className="pt-1">
                {slots.length === 0 ? <p className="text-xs text-[var(--muted)]">No slots match.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => {
                      const Icon = ICON[s.status];
                      return (
                        <button key={s.label} type="button" onClick={() => setSelected(s.label)}
                          aria-label={`${s.label} — ${STATUS_META[s.status].label}`}
                          className={`flex size-14 flex-col items-center justify-center rounded-lg text-xs font-semibold transition ${BG[s.status]} ${selected === s.label ? "ring-2 ring-offset-2 ring-[var(--brand)] ring-offset-[var(--surface)]" : ""}`}>
                          <Icon className="size-3.5" />
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail panel */}
      {sel && (
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base">Slot {sel.label} <Badge tone={STATUS_META[sel.status].tone}>{STATUS_META[sel.status].label}</Badge></CardTitle></CardHeader>
          <CardContent className="grid gap-2 pt-1 text-sm">
            <p className="text-[var(--muted)]">Price {money(sel.price)} · {sel.active ? "active" : "inactive"}{sel.heldBy ? ` · held by ${sel.heldBy}` : ""}</p>
            {sel.status === "OnHold" && sel.expiresAt && <p className="text-amber-700 dark:text-amber-400">Expires {sel.expiresAt.slice(0, 16).replace("T", " ")} · {countdown(sel.expiresAt, now)}</p>}
            {sel.status === "Reserved" && sel.reservedInvoice && <p className="text-[var(--muted)]">Invoice {sel.reservedInvoice} · approved by {sel.approvedBy ?? "—"}</p>}
            {actionsFor(sel).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {actionsFor(sel).map((a) => (
                  <Button key={a.action} variant="secondary" className="h-8 px-3 text-xs" disabled={busy === `${sel.label}:${a.action}`} onClick={() => act(sel.label, a.action, a.admin)}>{a.label}</Button>
                ))}
              </div>
            )}
            {actionsFor(sel).length === 0 && <p className="text-xs text-[var(--muted)]">No actions available for your role on this slot.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
