"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { STATUS_META } from "@/lib/admin/slot-status";
import type { SlotConfig, SlotLayoutEntry, SlotZone } from "@/lib/admin/slots";

const COLS = 6;
const ROWS = 4;

type Layout = Record<string, SlotLayoutEntry>;

export function AdminSlotLayoutEditor({
  catalog, config, zones: initialZones, layout: initialLayout,
}: { catalog: string[]; config: SlotConfig; zones: SlotZone[]; layout: Layout }) {
  const router = useRouter();
  const [zones, setZones] = useState<SlotZone[]>([...initialZones].sort((a, b) => a.order - b.order));
  const [layout, setLayout] = useState<Layout>({ ...initialLayout });
  const [active, setActive] = useState<Set<string>>(new Set(config.activeSlots));
  const [prices, setPrices] = useState<Record<string, number>>({ ...config.priceBySlot });
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [newZone, setNewZone] = useState("");

  const placed = useMemo(() => new Set(Object.keys(layout)), [layout]);
  const palette = useMemo(() => catalog.filter((s) => active.has(s) && !placed.has(s)), [catalog, active, placed]);
  const occupiedByZone = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const p of Object.values(layout)) {
      const key = m.get(p.zoneId) ?? new Set<string>();
      key.add(`${p.x},${p.y}`);
      m.set(p.zoneId, key);
    }
    return m;
  }, [layout]);

  function touch() { setDirty(true); setSaved(false); }

  function place(label: string, zoneId: string, x: number, y: number) {
    if (occupiedByZone.get(zoneId)?.has(`${x},${y}`)) return; // cell taken
    setLayout((l) => ({ ...l, [label]: { zoneId, x, y } }));
    setSelected(label); touch();
  }
  function unplace(label: string) {
    setLayout((l) => { const n = { ...l }; delete n[label]; return n; });
    if (selected === label) setSelected(null);
    touch();
  }
  function addZone() {
    const name = newZone.trim();
    if (!name) return;
    setZones((z) => [...z, { id: `zone-${Date.now()}`, name, order: z.length }]);
    setNewZone(""); touch();
  }
  function renameZone(id: string, name: string) { setZones((z) => z.map((zz) => (zz.id === id ? { ...zz, name } : zz))); touch(); }
  function moveZone(id: string, dir: -1 | 1) {
    setZones((z) => {
      const i = z.findIndex((zz) => zz.id === id);
      const j = i + dir;
      if (j < 0 || j >= z.length) return z;
      const copy = [...z];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy.map((zz, idx) => ({ ...zz, order: idx }));
    });
    touch();
  }
  function toggleActive(label: string) {
    setActive((a) => { const n = new Set(a); if (n.has(label)) { n.delete(label); } else n.add(label); return n; });
    touch();
  }
  function setPrice(label: string, v: number) { setPrices((p) => ({ ...p, [label]: v })); touch(); }

  async function save() {
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/admin/slots/layout", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ zones, layout, activeSlots: [...active], priceBySlot: prices }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Save failed."); return; }
      setSaved(true); setDirty(false); router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="grid gap-5">
      {/* Desktop-only notice (mobile) */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 md:hidden dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        Layout editing is desktop-only. The zones + slot counts are listed below; open this page on a larger screen to drag slots.
      </div>

      {/* Mobile read-only summary */}
      <div className="grid gap-2 md:hidden">
        {zones.map((z) => (
          <Card key={z.id}><CardContent className="flex items-center justify-between pt-4">
            <span className="text-sm font-medium">{z.name}</span>
            <Badge tone="neutral">{Object.values(layout).filter((p) => p.zoneId === z.id).length} slots</Badge>
          </CardContent></Card>
        ))}
      </div>

      {/* Desktop editor */}
      <div className="hidden gap-5 md:grid lg:grid-cols-[1fr_260px]">
        <div className="grid gap-4">
          {zones.map((z) => (
            <Card key={z.id}>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <input aria-label={`Zone ${z.id} name`} value={z.name} onChange={(e) => renameZone(z.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-base font-semibold hover:border-[var(--border)] focus:border-[var(--brand)] focus:outline-none" />
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Move zone up" className="rounded border border-[var(--border)] px-1.5 text-xs" onClick={() => moveZone(z.id, -1)}>↑</button>
                  <button type="button" aria-label="Move zone down" className="rounded border border-[var(--border)] px-1.5 text-xs" onClick={() => moveZone(z.id, 1)}>↓</button>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="grid w-fit gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 3rem)` }}
                  role="grid" aria-label={`${z.name} grid`}>
                  {Array.from({ length: COLS * ROWS }).map((_, idx) => {
                    const x = idx % COLS, y = Math.floor(idx / COLS);
                    const occupant = Object.entries(layout).find(([, p]) => p.zoneId === z.id && p.x === x && p.y === y)?.[0];
                    return (
                      <div key={idx}
                        onDragOver={(e) => { if (!occupant) e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); const label = e.dataTransfer.getData("text/slot"); if (label) place(label, z.id, x, y); }}
                        className={`flex size-12 items-center justify-center rounded-md border text-xs font-semibold ${occupant ? "" : "border-dashed border-[var(--border)] text-[var(--muted)]"}`}>
                        {occupant ? (
                          <div draggable onDragStart={(e) => e.dataTransfer.setData("text/slot", occupant)} onClick={() => setSelected(occupant)}
                            className={`relative flex size-full cursor-move items-center justify-center rounded-md text-white ${selected === occupant ? "ring-2 ring-[var(--brand)]" : ""}`}
                            style={{ backgroundColor: "var(--brand)" }} title={occupant}>
                            {occupant}
                            <button type="button" aria-label={`Remove ${occupant}`} onClick={(e) => { e.stopPropagation(); unplace(occupant); }}
                              className="absolute -right-1 -top-1 rounded-full bg-rose-600 p-0.5 text-white"><X className="size-2.5" /></button>
                          </div>
                        ) : <span className="text-[10px] opacity-40">{String.fromCharCode(65 + x)}{y + 1}</span>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card><CardContent className="flex items-end gap-2 pt-5">
            <Field label="Add zone"><Input aria-label="New zone name" value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="Hall C — VIP" /></Field>
            <Button variant="secondary" onClick={addZone}><Plus className="mr-1 size-4" /> Add zone</Button>
          </CardContent></Card>
        </div>

        {/* Side panel: palette + selected slot props + save */}
        <div className="grid content-start gap-4 lg:sticky lg:top-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Unplaced slots</CardTitle></CardHeader>
            <CardContent className="pt-1">
              {palette.length === 0 ? <p className="text-xs text-[var(--muted)]">All active slots are placed.</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {palette.map((s) => (
                    <span key={s} draggable onDragStart={(e) => e.dataTransfer.setData("text/slot", s)}
                      className="cursor-move rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold hover:bg-[var(--background)]">{s}</span>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-[var(--muted)]">Drag a slot onto a grid cell to place it.</p>
            </CardContent>
          </Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-base">{selected ? `Slot ${selected}` : "Slot properties"}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 pt-1">
              {selected ? (
                <>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active.has(selected)} onChange={() => toggleActive(selected)} /> Active (offered for reservation)</label>
                  <Field label={`Price (${config.currency})`}><Input aria-label="Slot price" type="number" min={0} value={prices[selected] ?? 0} onChange={(e) => setPrice(selected, Number(e.target.value))} /></Field>
                  <Button variant="secondary" className="text-rose-600 dark:text-rose-400" onClick={() => unplace(selected)}>Remove from layout</Button>
                </>
              ) : <p className="text-xs text-[var(--muted)]">Select a placed slot to set its price + active state.</p>}
            </CardContent>
          </Card>

          <Card><CardContent className="grid gap-2 pt-5">
            <div className="flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
              {(["Available", "OnHold", "Reserved", "Inactive"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1"><span className={`size-2 rounded-full ${STATUS_META[s].tone === "green" ? "bg-emerald-500" : STATUS_META[s].tone === "amber" ? "bg-amber-500" : STATUS_META[s].tone === "rose" ? "bg-rose-500" : "bg-slate-400"}`} />{STATUS_META[s].label}</span>
              ))}
            </div>
            {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
            <Button onClick={save} disabled={saving || !dirty}>{saving ? <><Loader2 className="mr-1 size-4 animate-spin" /> Saving</> : saved ? <><Check className="mr-1 size-4" /> Saved</> : "Save layout"}</Button>
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
