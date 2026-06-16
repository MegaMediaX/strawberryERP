"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  CUSTOM_FIELD_TARGET_LABELS,
  CUSTOM_FIELD_TARGET_LIST,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_TYPE_LIST,
  suggestFieldName,
  type CustomFieldTarget,
  type CustomFieldType,
} from "@/lib/admin/custom-fields-ui";
import type { CustomFieldRecord } from "@/lib/admin/custom-fields";

/** A faithful preview of how the field control renders in a form (§31). */
function PreviewControl({ type, label, options, required }: { type: CustomFieldType; label: string; options: string[]; required: boolean }) {
  const lbl = (label || "Field label") + (required ? " *" : "");
  const base = "pointer-events-none w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)]";
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium">{lbl}</span>
      {type === "checkbox" ? <span className="inline-flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" disabled /> Yes / No</span>
        : type === "dropdown" ? <select disabled className={base}>{(options.length ? options : ["Option 1", "Option 2"]).map((o) => <option key={o}>{o}</option>)}</select>
        : type === "textarea" ? <div className={`${base} h-14`}>Long text…</div>
        : type === "file" ? <div className={base}>Choose file…</div>
        : <div className={base}>{type === "date" ? "yyyy-mm-dd" : type === "number" ? "0" : type === "currency" ? "$ 0.00" : type === "phone" ? "+961 …" : type === "email" ? "name@example.com" : "Sample text"}</div>}
    </div>
  );
}

export function AdminCustomFieldsView({ fields }: { fields: CustomFieldRecord[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<CustomFieldTarget>("leads");
  const [label, setLabel] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);
  const [searchable, setSearchable] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of CUSTOM_FIELD_TARGET_LIST) c[t] = 0;
    for (const f of fields) c[f.target] = (c[f.target] ?? 0) + 1;
    return c;
  }, [fields]);
  const visible = useMemo(() => fields.filter((f) => f.target === target), [fields, target]);
  const options = useMemo(() => optionsText.split(/\n|,/).map((o) => o.trim()).filter(Boolean), [optionsText]);

  function onLabel(v: string) {
    setLabel(v);
    // keep the machine name in sync until the user edits it manually
    if (!fieldName || fieldName === suggestFieldName(label)) setFieldName(suggestFieldName(v));
  }

  async function add() {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/custom-fields", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, label, fieldName, fieldType, options: fieldType === "dropdown" ? options : undefined, required, searchable }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Could not add field."); return; }
      setLabel(""); setFieldName(""); setFieldType("text"); setOptionsText(""); setRequired(false); setSearchable(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/custom-fields", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "remove" }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      {/* Module selector */}
      <nav aria-label="Module" className="flex flex-wrap gap-2">
        {CUSTOM_FIELD_TARGET_LIST.map((t) => (
          <button key={t} type="button" onClick={() => setTarget(t)} aria-current={t === target ? "true" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${t === target ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>
            {CUSTOM_FIELD_TARGET_LABELS[t]}<span className={`rounded-full px-1.5 text-[10px] ${t === target ? "bg-white/25" : "bg-[var(--background)]"}`}>{counts[t]}</span>
          </button>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Add field */}
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Add field to {CUSTOM_FIELD_TARGET_LABELS[target]}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 pt-1">
            <Field label="Label"><Input aria-label="Label" value={label} onChange={(e) => onLabel(e.target.value)} placeholder="Account Tier" /></Field>
            <Field label="Field name (machine)"><Input aria-label="Field name" value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="account_tier" /></Field>
            <Field label="Type"><Select aria-label="Type" value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)}>{CUSTOM_FIELD_TYPE_LIST.map((t) => <option key={t} value={t}>{CUSTOM_FIELD_TYPE_LABELS[t]}</option>)}</Select></Field>
            {fieldType === "dropdown" && <Field label="Options (one per line or comma-separated)"><Textarea aria-label="Options" rows={3} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={"Gold\nSilver\nBronze"} /></Field>}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={searchable} onChange={(e) => setSearchable(e.target.checked)} /> Searchable / filterable</label>
            </div>
            {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
            <div><Button onClick={add} disabled={busy}><Plus className="mr-1 size-4" /> Add field</Button></div>
            <p className="text-xs text-[var(--muted)]">Custom fields appear automatically in {CUSTOM_FIELD_TARGET_LABELS[target]} forms. Reserved core fields (country, status, …) are blocked.</p>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Preview</CardTitle></CardHeader>
          <CardContent className="pt-1">
            <div className="rounded-xl border border-dashed border-[var(--border)] p-4">
              <PreviewControl type={fieldType} label={label} options={options} required={required} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Existing fields */}
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">{CUSTOM_FIELD_TARGET_LABELS[target]} fields ({visible.length})</CardTitle></CardHeader>
        <CardContent className="pt-1">
          {visible.length === 0 ? <EmptyState title="No custom fields yet" description={`Add the first custom field for ${CUSTOM_FIELD_TARGET_LABELS[target]}.`} /> : (
            <div className="grid gap-2">
              {visible.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.label} <code className="font-mono text-xs text-[var(--muted)]">{f.fieldName}</code></p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="blue">{CUSTOM_FIELD_TYPE_LABELS[f.fieldType as CustomFieldType] ?? f.fieldType}</Badge>
                      {f.required && <Badge tone="amber">Required</Badge>}
                      {f.searchable && <Badge tone="green">Searchable</Badge>}
                      {f.options && f.options.length > 0 && <Badge tone="neutral">{f.options.length} options</Badge>}
                    </div>
                  </div>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" disabled={busy} onClick={() => remove(f.id)}><Trash2 className="mr-1 size-3.5" /> Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
