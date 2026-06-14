"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { allowedCountries } from "@/lib/sample-data";
import type { CurrencySetting } from "@/lib/phase2-data";

type Mode = "create" | "edit";

const emptyCurrency: CurrencySetting = {
  currencyCode: "",
  currencyName: "",
  symbol: "",
  decimalPrecision: 2,
  isActive: true,
  isDefault: false,
  assignedCountries: [],
  assignedResellers: [],
  manualExchangeRate: 1,
};

export function CurrencyForm({ mode, initial }: { mode: Mode; initial?: CurrencySetting }) {
  const [form, setForm] = useState<CurrencySetting>(initial ?? emptyCurrency);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof CurrencySetting>(key: K, value: CurrencySetting[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCountry(country: (typeof allowedCountries)[number]) {
    setForm((prev) => ({
      ...prev,
      assignedCountries: prev.assignedCountries.includes(country)
        ? prev.assignedCountries.filter((c) => c !== country)
        : [...prev.assignedCountries, country],
    }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/settings/currencies", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, currencyCode: form.currencyCode.toUpperCase() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not save the currency.");
        return;
      }
      window.location.href = "/settings/currencies";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const toggleBtn = (on: boolean) =>
    on
      ? "inline-flex h-9 items-center rounded-full bg-[var(--brand)] px-3 text-xs font-semibold text-white"
      : "inline-flex h-9 items-center rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)]";

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{mode === "create" ? "New currency" : `Edit ${form.currencyCode}`}</CardTitle>
        <CardDescription>3-letter ISO code. Assigned countries are validated (blocked countries rejected).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Code (ISO)">
            <Input
              value={form.currencyCode}
              disabled={mode === "edit"}
              maxLength={3}
              onChange={(e) => set("currencyCode", e.target.value.toUpperCase())}
              placeholder="USD"
            />
          </Field>
          <Field label="Name">
            <Input value={form.currencyName} onChange={(e) => set("currencyName", e.target.value)} placeholder="US Dollar" />
          </Field>
          <Field label="Symbol">
            <Input value={form.symbol} onChange={(e) => set("symbol", e.target.value)} placeholder="$" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Decimal precision">
            <Select value={String(form.decimalPrecision)} onChange={(e) => set("decimalPrecision", Number(e.target.value))}>
              {[0, 1, 2, 3, 4].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Manual exchange rate">
            <Input
              type="number"
              step="0.0001"
              value={String(form.manualExchangeRate)}
              onChange={(e) => set("manualExchangeRate", Number(e.target.value))}
              inputMode="decimal"
            />
          </Field>
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Assigned countries</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedCountries.map((c) => (
              <button key={c} type="button" onClick={() => toggleCountry(c)} className={toggleBtn(form.assignedCountries.includes(c))}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => set("isActive", !form.isActive)} className={toggleBtn(form.isActive)}>
            {form.isActive ? "Active" : "Inactive"}
          </button>
          <button type="button" onClick={() => set("isDefault", !form.isDefault)} className={toggleBtn(form.isDefault)}>
            {form.isDefault ? "Default" : "Not default"}
          </button>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {busy ? "Saving…" : mode === "create" ? "Create currency" : "Save changes"}
          </button>
          <Link
            href="/settings/currencies"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
          >
            Cancel
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
