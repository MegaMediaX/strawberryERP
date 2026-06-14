"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { allowedCountries } from "@/lib/sample-data";
import type { Reseller } from "@/lib/business/reseller-defaults";

type Mode = "create" | "edit";

// Inlined to keep this client bundle free of server-only modules.
const TRIGGERS = ["Invoice Created", "Deposit Paid", "Fully Paid"] as const;
const VISIBILITY = ["All Countries", "Assigned Countries"] as const;

const emptyReseller: Reseller = {
  name: "",
  countries: [],
  defaultCurrency: "",
  defaultCommissionPercentage: 10,
  defaultCommissionTrigger: "Fully Paid",
  visibility: "Assigned Countries",
  isActive: true,
};

export function ResellerForm({
  mode,
  initial,
  currencies,
}: {
  mode: Mode;
  initial?: Reseller;
  currencies: string[];
}) {
  const [form, setForm] = useState<Reseller>(initial ?? { ...emptyReseller, defaultCurrency: currencies[0] ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Reseller>(key: K, value: Reseller[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCountry(country: (typeof allowedCountries)[number]) {
    setForm((prev) => ({
      ...prev,
      countries: prev.countries.includes(country)
        ? prev.countries.filter((c) => c !== country)
        : [...prev.countries, country],
    }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/settings/resellers", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not save the reseller.");
        return;
      }
      window.location.href = "/settings/resellers";
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
        <CardTitle>{mode === "create" ? "New reseller" : `Edit ${form.name}`}</CardTitle>
        <CardDescription>Assigned countries are validated (blocked countries rejected). Defaults seed new commission rules.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={form.name} disabled={mode === "edit"} onChange={(e) => set("name", e.target.value)} placeholder="Beirut Digital Partners" />
          </Field>
          <Field label="Default currency">
            <Select value={form.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value)}>
              <option value="">Select…</option>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Countries</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedCountries.map((c) => (
              <button key={c} type="button" onClick={() => toggleCountry(c)} className={toggleBtn(form.countries.includes(c))}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Commission %">
            <Input
              type="number"
              min={0}
              max={100}
              value={String(form.defaultCommissionPercentage)}
              onChange={(e) => set("defaultCommissionPercentage", Number(e.target.value))}
              inputMode="decimal"
            />
          </Field>
          <Field label="Commission trigger">
            <Select value={form.defaultCommissionTrigger} onChange={(e) => set("defaultCommissionTrigger", e.target.value as Reseller["defaultCommissionTrigger"])}>
              {TRIGGERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Visibility">
            <Select value={form.visibility} onChange={(e) => set("visibility", e.target.value as Reseller["visibility"])}>
              {VISIBILITY.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => set("isActive", !form.isActive)} className={toggleBtn(form.isActive)}>
            {form.isActive ? "Active" : "Inactive"}
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
            {busy ? "Saving…" : mode === "create" ? "Create reseller" : "Save changes"}
          </button>
          <Link
            href="/settings/resellers"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
          >
            Cancel
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
