"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileUp, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import {
  autoMapColumns,
  buildRecord,
  csvTemplate,
  DUPLICATE_POLICIES,
  errorLogCsv,
  parseCsv,
  SYSTEM_FIELDS,
  validateRecords,
  type ColumnMapping,
  type DuplicatePolicy,
  type ImportDefaults,
  type ImportRecord,
  type ImportSummary,
  type ParsedCsv,
} from "@/lib/reseller/csv-import";
import { parseImportResponse } from "@/lib/reseller/import-response";
import { leadSources } from "@/lib/business/new-lead";

const POLICY_LABEL: Record<DuplicatePolicy, string> = {
  skip: "Skip duplicates",
  "update": "Update existing",
  "import-anyway": "Import anyway",
  "mark-duplicate": "Mark as possible duplicate",
};

const btnPrimary = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)] disabled:opacity-50";
const btnGhost = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function ResellerCsvImport({
  countries, assignees, existingKeys,
}: {
  countries: readonly string[];
  assignees: readonly string[];
  existingKeys: readonly string[];
}) {
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaults, setDefaults] = useState<ImportDefaults>({});
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [importErr, setImportErr] = useState("");

  const records = useMemo<ImportRecord[]>(() => {
    if (!parsed) return [];
    const built = parsed.rows.map((cells) => buildRecord(cells, mapping, defaults));
    return validateRecords(built, { countries, assignees, existingKeys });
  }, [parsed, mapping, defaults, countries, assignees, existingKeys]);

  const counts = useMemo(() => {
    const valid = records.filter((r) => r.errors.length === 0);
    const dups = valid.filter((r) => r.duplicate).length;
    return { total: records.length, valid: valid.length, invalid: records.length - valid.length, dups };
  }, [records]);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const p = parseCsv(text);
      setParsed(p);
      setMapping(autoMapColumns(p.headers));
      setResult(null);
      setStep(2);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (busy) return;
    setBusy(true); setImportErr("");
    try {
      const res = await fetch("/api/frappe/leads/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ records, duplicatePolicy: policy }),
      });
      const body = await res.json().catch(() => ({}));
      const parsed = parseImportResponse(body);
      if (res.ok && parsed.ok && parsed.summary) {
        setResult(parsed.summary); setStep(4);
      } else {
        setImportErr(parsed.error ?? "Import failed. Please try again.");
      }
    } catch {
      setImportErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Link href="/reseller/leads" aria-label="Back to leads" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Import leads from CSV</h1>
          <p className="text-sm text-[var(--muted)]">Step {Math.min(step, 4)} of 4 · {["Upload", "Map columns", "Preview & defaults", "Result"][Math.min(step, 4) - 1]}</p>
        </div>
      </div>

      {/* Step 1 — Upload */}
      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>Upload a CSV</CardTitle><CardDescription>Header row required. Columns: {SYSTEM_FIELDS.map((f) => f.label).join(", ")}.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center hover:bg-[var(--background)]">
              <FileUp className="size-8 text-[var(--muted)]" />
              <span className="text-sm font-semibold">Choose a .csv file</span>
              <span className="text-xs text-[var(--muted)]">We never import blindly — you&apos;ll preview every row first.</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            <button onClick={() => downloadText("lebtech-leads-template.csv", csvTemplate())} className={btnGhost}>
              <Download className="size-4" /> Download template
            </button>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 2 — Map columns */}
      {step === 2 && parsed ? (
        <Card>
          <CardHeader><CardTitle>Map columns</CardTitle><CardDescription>We auto-matched your headers. Adjust any field below; choose “— skip —” to ignore a system field.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {SYSTEM_FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                <Select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                >
                  <option value="">— skip —</option>
                  {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </Select>
              </Field>
            ))}
            <div className="sm:col-span-2 flex gap-2">
              <button onClick={() => setStep(1)} className={btnGhost}><ArrowLeft className="size-4" /> Back</button>
              <button onClick={() => setStep(3)} className={btnPrimary}>Continue to preview</button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 3 — Preview + defaults + policy */}
      {step === 3 && parsed ? (
        <>
          <Card>
            <CardHeader><CardTitle>Assign defaults</CardTitle><CardDescription>Used to fill blank cells. Country + assignee are limited to your reseller.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Default country"><Select value={defaults.country ?? ""} onChange={(e) => setDefaults((d) => ({ ...d, country: e.target.value || undefined }))}><option value="">None</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Default assigned user"><Select value={defaults.assignedUser ?? ""} onChange={(e) => setDefaults((d) => ({ ...d, assignedUser: e.target.value || undefined }))}><option value="">None</option>{assignees.map((a) => <option key={a}>{a}</option>)}</Select></Field>
              <Field label="Default source"><Select value={defaults.source ?? ""} onChange={(e) => setDefaults((d) => ({ ...d, source: e.target.value || undefined }))}><option value="">CSV Import</option>{leadSources.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Duplicate handling"><Select value={policy} onChange={(e) => setPolicy(e.target.value as DuplicatePolicy)}>{DUPLICATE_POLICIES.map((p) => <option key={p} value={p}>{POLICY_LABEL[p]}</option>)}</Select></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview — {counts.total} rows</CardTitle>
              <CardDescription>
                <span className="font-semibold text-emerald-600">{counts.valid} valid</span>
                {counts.invalid ? <> · <span className="font-semibold text-rose-600">{counts.invalid} with errors</span></> : null}
                {counts.dups ? <> · <span className="font-semibold text-amber-600">{counts.dups} duplicate</span></> : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-semibold">#</th><th className="py-2 pr-3 font-semibold">Company</th><th className="py-2 pr-3 font-semibold">Country</th><th className="py-2 pr-3 font-semibold">Assigned</th><th className="py-2 pr-3 font-semibold">Status</th>
                </tr></thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.rowNumber} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-3 align-top text-[var(--muted)]">{r.rowNumber}</td>
                      <td className="py-2 pr-3 align-top font-medium">{r.data.companyName || <span className="text-[var(--muted)]">—</span>}</td>
                      <td className="py-2 pr-3 align-top">{r.data.country || "—"}</td>
                      <td className="py-2 pr-3 align-top">{r.data.assignedUser || "—"}</td>
                      <td className="py-2 pr-3 align-top">
                        {r.errors.length ? <Badge tone="rose">{r.errors.join("; ")}</Badge>
                          : r.duplicate ? <Badge tone="amber">Possible duplicate</Badge>
                          : <Badge tone="green">Ready</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStep(2)} className={btnGhost}><ArrowLeft className="size-4" /> Back to mapping</button>
            {counts.invalid ? <button onClick={() => downloadText("import-errors.csv", errorLogCsv(records))} className={btnGhost}><Download className="size-4" /> Download error file</button> : null}
            <button onClick={runImport} disabled={busy || counts.valid === 0} className={btnPrimary}>
              <Upload className="size-4" /> {busy ? "Importing…" : `Import ${counts.valid} lead${counts.valid === 1 ? "" : "s"}`}
            </button>
          </div>
          {importErr ? <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">{importErr}</p> : null}
        </>
      ) : null}

      {/* Step 4 — Result */}
      {step === 4 && result ? (
        <Card>
          <CardHeader><CardTitle>Import complete</CardTitle><CardDescription>Dev-store mode: this is a simulated result — no records were persisted to a backend.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border)] p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{result.imported}</p><p className="text-xs text-[var(--muted)]">Imported</p></div>
              <div className="rounded-xl border border-[var(--border)] p-4 text-center"><p className="text-2xl font-bold">{result.skipped}</p><p className="text-xs text-[var(--muted)]">Skipped</p></div>
              <div className="rounded-xl border border-[var(--border)] p-4 text-center"><p className="text-2xl font-bold text-amber-600">{result.duplicates}</p><p className="text-xs text-[var(--muted)]">Duplicates</p></div>
            </div>
            <div className="flex gap-2">
              <Link href="/reseller/leads" className={btnPrimary}>View leads</Link>
              <button onClick={() => { setParsed(null); setMapping({}); setDefaults({}); setResult(null); setStep(1); }} className={btnGhost}>Import another file</button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
