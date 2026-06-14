"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { allowedCountries, leadStatuses } from "@/lib/sample-data";
import {
  emptyNewLead,
  leadSources,
  toLeadRequestBody,
  validateNewLeadInput,
  type NewLeadInput,
} from "@/lib/business/new-lead";

const btnPrimary =
  "inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60";
const btnGhost =
  "inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]";

export function NewLeadForm({ onCreated, defaultAssignedUser }: { onCreated?: () => void; defaultAssignedUser?: string }) {
  const [form, setForm] = useState<NewLeadInput>(
    defaultAssignedUser ? { ...emptyNewLead, assignedUser: defaultAssignedUser } : emptyNewLead,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof NewLeadInput>(key: K, value: NewLeadInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const validation = validateNewLeadInput(form);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toLeadRequestBody(form)),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        const message =
          typeof body.error === "string" ? body.error : body.error?.message ?? "Could not create the lead.";
        setError(message);
        return;
      }
      setSuccess(`${form.companyName.trim()} was added.`);
      setForm(emptyNewLead);
      onCreated?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New lead</CardTitle>
        <CardDescription>Add a lead. It will be scoped to your country, reseller, and assignment automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Acme Trading" />
          </Field>
          <Field label="Country">
            <Select value={form.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">Select country…</option>
              {allowedCountries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="First name">
            <Input value={form.contactFirstName} onChange={(e) => set("contactFirstName", e.target.value)} placeholder="Rami" />
          </Field>
          <Field label="Last name">
            <Input value={form.contactLastName} onChange={(e) => set("contactLastName", e.target.value)} placeholder="Khoury" />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => set("gender", e.target.value as NewLeadInput["gender"])}>
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
            </Select>
          </Field>
          <Field label="Assigned user">
            <Input value={form.assignedUser} onChange={(e) => set("assignedUser", e.target.value)} placeholder="you@company.com" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+961 70 123 456" inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@company.com" type="email" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {leadStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          {form.status === "Scheduled Follow-Up" ? (
            <Field label="Follow-up date">
              <Input type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} />
            </Field>
          ) : (
            <Field label="Source">
              <Select value={form.source} onChange={(e) => set("source", e.target.value)}>
                {leadSources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional context for the first call…" />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="sm:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              {success}
            </p>
          ) : null}

          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Adding…" : "Add lead"}
            </button>
            <button type="button" className={btnGhost} onClick={() => { setForm(emptyNewLead); setError(null); setSuccess(null); }}>
              Reset
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
