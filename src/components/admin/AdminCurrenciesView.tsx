"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type { CurrencySetting } from "@/lib/phase2-data";

export function AdminCurrenciesView({ currencies, usage }: { currencies: CurrencySetting[]; usage: Record<string, number> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [n, setN] = useState({ currencyCode: "", currencyName: "", symbol: "", decimalPrecision: "2" });
  const [err, setErr] = useState("");

  async function toggle(c: CurrencySetting) {
    if (c.isActive && (usage[c.currencyCode] ?? 0) > 0 && !window.confirm(`${c.currencyCode} is used in ${usage[c.currencyCode]} invoice(s). Disabling prevents new invoices in this currency. Continue?`)) return;
    setBusy(c.currencyCode);
    try { await fetch("/api/admin/accounting/currencies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ currencyCode: c.currencyCode, isActive: !c.isActive }) }); router.refresh(); }
    finally { setBusy(null); }
  }
  async function add() {
    if (addBusy) return;
    setAddBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/accounting/currencies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...n, decimalPrecision: Number(n.decimalPrecision), isActive: true }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Add failed."); return; }
      setAdding(false); setN({ currencyCode: "", currencyName: "", symbol: "", decimalPrecision: "2" }); router.refresh();
    } catch {
      setErr("Network error. Please try again.");
    } finally { setAddBusy(false); }
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"><Plus className="size-4" /> Add currency</button>
      </div>
      {currencies.map((c) => (
        <Card key={c.currencyCode}><CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{c.currencyCode} <span className="font-normal text-[var(--muted)]">{c.symbol} · {c.currencyName}</span></p>
            <p className="flex flex-wrap gap-1.5 pt-1 text-xs text-[var(--muted)]">
              <Badge tone="neutral">precision {c.decimalPrecision}</Badge>
              {c.isDefault && <Badge tone="blue">default</Badge>}
              <Badge tone="neutral">{usage[c.currencyCode] ?? 0} invoices</Badge>
            </p>
          </div>
          <Badge tone={c.isActive ? "green" : "neutral"}>{c.isActive ? "Enabled" : "Disabled"}</Badge>
          <button type="button" disabled={busy === c.currencyCode} className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold hover:bg-[var(--background)]" onClick={() => toggle(c)}>{c.isActive ? "Disable" : "Enable"}</button>
        </CardContent></Card>
      ))}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add currency" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <h2 className="text-base font-bold tracking-tight">Add currency</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Code (ISO)"><Input aria-label="Currency code" value={n.currencyCode} placeholder="AED" onChange={(e) => setN((s) => ({ ...s, currencyCode: e.target.value.toUpperCase() }))} /></Field>
              <Field label="Symbol"><Input aria-label="Currency symbol" value={n.symbol} placeholder="د.إ" onChange={(e) => setN((s) => ({ ...s, symbol: e.target.value }))} /></Field>
              <Field label="Name"><Input aria-label="Currency name" value={n.currencyName} placeholder="UAE Dirham" onChange={(e) => setN((s) => ({ ...s, currencyName: e.target.value }))} /></Field>
              <Field label="Decimal precision"><Input aria-label="Decimal precision" type="number" min={0} max={4} value={n.decimalPrecision} onChange={(e) => setN((s) => ({ ...s, decimalPrecision: e.target.value }))} /></Field>
            </div>
            {err && <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
            <div className="mt-4 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button><Button className="flex-1" onClick={add} disabled={addBusy}>{addBusy ? "Adding…" : "Add currency"}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
