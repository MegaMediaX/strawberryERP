"use client";

import { useMemo, useState } from "react";
import { Info, Lock, Plus, Trash2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  resolveImportantDetails,
  validateImportantDetailEntry,
  type ApplyScope,
  type ImportantDetailEntry,
} from "@/lib/business/important-details-mgmt";
import type { PortalLead } from "@/lib/ui-data";

type Draft = {
  id: string;
  title: string;
  bodyText: string; // one line per bullet
  scope: ApplyScope;
  value: string;
};

const SCOPE_LABEL: Record<ApplyScope, string> = {
  all: "All leads", country: "Specific country", source: "Specific source", priority: "Specific priority",
};

const btnPrimary = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)] disabled:opacity-50";
const btnGhost = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

function toDraft(e: ImportantDetailEntry): Draft {
  return { id: e.id, title: e.title, bodyText: e.body.join("\n"), scope: e.applyTo.scope, value: e.applyTo.value ?? "" };
}
function toEntry(d: Draft, reseller: string): ImportantDetailEntry {
  return {
    id: d.id, reseller, title: d.title, body: d.bodyText.split("\n").map((l) => l.trim()).filter(Boolean),
    applyTo: { scope: d.scope, value: d.scope === "all" ? undefined : d.value }, updatedAt: "",
  };
}

let draftSeq = 0;

export function ResellerImportantDetails({
  reseller, initialEntries, locked, countries, sources, priorities,
}: {
  reseller: string;
  initialEntries: ImportantDetailEntry[];
  locked: boolean;
  countries: readonly string[];
  sources: readonly string[];
  priorities: readonly string[];
}) {
  const [drafts, setDrafts] = useState<Draft[]>(initialEntries.map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function add() {
    setDrafts((ds) => [...ds, { id: `new-${draftSeq++}`, title: "", bodyText: "", scope: "all", value: "" }]);
  }
  function remove(id: string) {
    setDrafts((ds) => ds.filter((d) => d.id !== id));
  }

  const valueOptions = (scope: ApplyScope): readonly string[] =>
    scope === "country" ? countries : scope === "source" ? sources : scope === "priority" ? priorities : [];

  // Live preview of how the call screen resolves these entries for a sample lead.
  const previewLead = useMemo(
    () => ({ reseller, country: countries[0], source: sources[0], priority: "VIP" }) as PortalLead,
    [reseller, countries, sources],
  );
  const previewLines = useMemo(
    () => resolveImportantDetails(previewLead, drafts.map((d) => toEntry(d, reseller))),
    [drafts, previewLead, reseller],
  );

  async function save() {
    setError(null); setSuccess(null);
    const entries = drafts.map((d) => toEntry(d, reseller));
    for (const [i, e] of entries.entries()) {
      const v = validateImportantDetailEntry(e);
      if (v) { setError(`Entry ${i + 1}: ${v}`); return; }
    }
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/settings/important-details", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not save."); return; }
      const saved = (body.data?.entries ?? []) as ImportantDetailEntry[];
      setDrafts(saved.map(toDraft));
      setSuccess("Saved. Your sales team will see these on the call screen.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Important details</h1>
        <p className="text-sm text-[var(--muted)]">Guidance your sales team sees on the lead call screen.</p>
      </div>

      {locked ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <Lock className="size-4 shrink-0" /> Controlled by Super Admin — you can view these but not edit them.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3">
          {drafts.length === 0 ? (
            <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">No entries yet. Add one to guide your team.</p></CardContent></Card>
          ) : drafts.map((d, i) => (
            <Card key={d.id}>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Entry {i + 1}</CardTitle>
                {!locked ? (
                  <button onClick={() => remove(d.id)} aria-label="Remove entry" className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--background)] hover:text-rose-600"><Trash2 className="size-4" /></button>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Title"><Input value={d.title} disabled={locked} onChange={(e) => update(d.id, { title: e.target.value })} placeholder="Call guidance" /></Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Details (one line per bullet)"><Textarea rows={4} value={d.bodyText} disabled={locked} onChange={(e) => update(d.id, { bodyText: e.target.value })} placeholder={"Mention package options clearly.\nDo not promise discounts without approval."} /></Field>
                </div>
                <Field label="Apply to">
                  <Select value={d.scope} disabled={locked} onChange={(e) => update(d.id, { scope: e.target.value as ApplyScope, value: "" })}>
                    {(Object.keys(SCOPE_LABEL) as ApplyScope[]).map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
                  </Select>
                </Field>
                {d.scope !== "all" ? (
                  <Field label={SCOPE_LABEL[d.scope].replace("Specific ", "")}>
                    <Select value={d.value} disabled={locked} onChange={(e) => update(d.id, { value: e.target.value })}>
                      <option value="">Select…</option>
                      {valueOptions(d.scope).map((v) => <option key={v}>{v}</option>)}
                    </Select>
                  </Field>
                ) : null}
              </CardContent>
            </Card>
          ))}

          {!locked ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={add} className={btnGhost}><Plus className="size-4" /> Add entry</button>
              <button onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          ) : null}

          {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error}</p> : null}
          {success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{success}</p> : null}
        </div>

        {/* Live preview — how the sales call screen renders these (amber card). */}
        <aside className="grid content-start gap-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><Info className="size-4 text-amber-600" /> Call-screen preview</CardTitle><CardDescription>For a sample {countries[0]} · VIP lead.</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                <ul className="grid gap-1.5 text-sm text-amber-900 dark:text-amber-100">
                  {previewLines.map((l, i) => <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{l}</span></li>)}
                </ul>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
