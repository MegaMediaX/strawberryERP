"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { allowedCountries } from "@/lib/sample-data";
import type { PaymentMethod } from "@/lib/phase2-data";

type Mode = "create" | "edit";

// Fixed method names (kept in sync with paymentMethodNames in
// @/lib/business/payment-methods; inlined to keep this client bundle free of
// server-only modules). The server re-validates against the canonical list.
const paymentMethodNames: PaymentMethod["methodName"][] = [
  "Cash",
  "Bank Transfer",
  "OMT",
  "Whish",
  "Credit/Debit Card",
  "Crypto",
];

const emptyMethod: PaymentMethod = {
  methodName: paymentMethodNames[0],
  isActive: true,
  countries: [],
  resellers: [],
  requiresReference: false,
  requiresAttachment: false,
  icon: "card",
  displayOrder: 99,
};

export function PaymentMethodForm({ mode, initial }: { mode: Mode; initial?: PaymentMethod }) {
  const [form, setForm] = useState<PaymentMethod>(initial ?? emptyMethod);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof PaymentMethod>(key: K, value: PaymentMethod[K]) {
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
      const res = await fetch("/api/frappe/settings/payment-methods", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not save the method.");
        return;
      }
      window.location.href = "/settings/payment-methods";
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
        <CardTitle>{mode === "create" ? "New payment method" : `Edit ${form.methodName}`}</CardTitle>
        <CardDescription>Method names are a fixed set. Assigned countries are validated (blocked countries rejected).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Method">
            <Select
              value={form.methodName}
              disabled={mode === "edit"}
              onChange={(e) => set("methodName", e.target.value as PaymentMethod["methodName"])}
            >
              {paymentMethodNames.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </Field>
          <Field label="Display order">
            <Input
              type="number"
              value={String(form.displayOrder)}
              onChange={(e) => set("displayOrder", Number(e.target.value))}
              inputMode="numeric"
            />
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

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => set("requiresReference", !form.requiresReference)} className={toggleBtn(form.requiresReference)}>
            Requires reference
          </button>
          <button type="button" onClick={() => set("requiresAttachment", !form.requiresAttachment)} className={toggleBtn(form.requiresAttachment)}>
            Requires attachment
          </button>
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
            {busy ? "Saving…" : mode === "create" ? "Create method" : "Save changes"}
          </button>
          <Link
            href="/settings/payment-methods"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
          >
            Cancel
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
