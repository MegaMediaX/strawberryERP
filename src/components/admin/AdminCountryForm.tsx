"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  previewInvoiceNumber, TIMEZONE_OPTIONS, validateCountryForm, type CountryRecord,
} from "@/lib/admin/countries";

const TABS = ["General", "Currency", "Timezone", "Invoicing", "Branding"] as const;
type Tab = (typeof TABS)[number];

export function AdminCountryForm({
  currencies,
  existingNames,
  existingPrefixes,
  initial,
}: {
  currencies: { code: string; name: string }[];
  existingNames: string[];
  existingPrefixes: string[];
  initial?: CountryRecord;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [tab, setTab] = useState<Tab>("General");
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? currencies[0]?.code ?? "USD");
  const [timezone, setTimezone] = useState(initial?.timezone ?? TIMEZONE_OPTIONS[0]);
  const [invoicePrefix, setInvoicePrefix] = useState(initial?.invoicePrefix ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  const preview = useMemo(() => previewInvoiceNumber(invoicePrefix), [invoicePrefix]);

  async function save() {
    const error = validateCountryForm({ name, currency, timezone, invoicePrefix }, { existingNames, existingPrefixes, isEdit });
    if (error) {
      setStatus("error"); setMessage(error);
      // Jump to the tab owning the offending field.
      if (/name|cannot be added|already exists/i.test(error)) setTab("General");
      else if (/currency/i.test(error)) setTab("Currency");
      else if (/timezone/i.test(error)) setTab("Timezone");
      else setTab("Invoicing");
      return;
    }
    setStatus("saving"); setMessage("");
    try {
      const res = await fetch("/api/admin/countries", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, currency, timezone, invoicePrefix }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setStatus("error"); setMessage(data.error ?? "Save failed."); setTab("General"); return; }
      router.push("/admin/countries");
      router.refresh();
    } catch { setStatus("error"); setMessage("Network error — country not saved."); }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{isEdit ? `Edit ${initial!.name}` : "Add country"}</h1>
        <p className="text-sm text-[var(--muted)]">Country settings affect invoices, reports, and permissions.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Country settings">
        {TABS.map((t, i) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${tab === t ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>
            {i + 1}. {t}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-5">
          {tab === "General" && (
            <Field label="Country name">
              <Input aria-label="Country name" value={name} disabled={isEdit} placeholder="e.g. Iraq" onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          {tab === "Currency" && (
            <Field label="Default currency">
              <Select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </Field>
          )}
          {tab === "Timezone" && (
            <Field label="Timezone">
              <Select aria-label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          )}
          {tab === "Invoicing" && (
            <div className="grid gap-3">
              <Field label="Invoice prefix">
                <Input aria-label="Invoice prefix" value={invoicePrefix} placeholder="e.g. LB-INV" onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())} />
              </Field>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">Invoice preview</p>
                <p className="font-mono text-sm font-semibold" aria-label="Invoice preview">{preview}</p>
              </div>
            </div>
          )}
          {tab === "Branding" && (
            <p className="text-sm text-[var(--muted)]">Country-level branding (logo, colors, footer) is managed in the White-Label slice. Defaults to global branding for now.</p>
          )}
        </CardContent>
      </Card>

      {status === "error" && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{message}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/admin/countries")} disabled={status === "saving"}>Cancel</Button>
        <Button onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : isEdit ? "Save changes" : "Create country"}</Button>
      </div>
    </div>
  );
}
