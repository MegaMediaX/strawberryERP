"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";

// Inlined to keep this client bundle free of server-only modules. The server
// re-validates against the canonical invoiceNumberingModes.
const MODES = ["Global", "Country Prefix"] as const;

interface Config {
  mode: string;
  prefix?: string;
  nextSequence?: number;
}

export function InvoiceNumberingForm() {
  const [config, setConfig] = useState<Config>({ mode: "Global", nextSequence: 1 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/frappe/settings/invoice-numbering")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (active && body?.data) setConfig(body.data as Config);
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/settings/invoice-numbering", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: Config; error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not save the setting.");
        return;
      }
      if (body.data) setConfig(body.data);
      setSuccess("Invoice numbering updated.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Invoice numbering</CardTitle>
        <CardDescription>How invoice numbers are generated platform-wide. Country Prefix adds a 2–4 letter prefix.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="Mode">
          <Select value={config.mode} onChange={(e) => set("mode", e.target.value)} disabled={!loaded}>
            {MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>

        {config.mode === "Country Prefix" ? (
          <Field label="Prefix (2–4 letters)">
            <Input
              value={config.prefix ?? ""}
              maxLength={4}
              onChange={(e) => set("prefix", e.target.value.toUpperCase())}
              placeholder="LB"
            />
          </Field>
        ) : null}

        <Field label="Next sequence">
          <Input
            type="number"
            min={1}
            value={String(config.nextSequence ?? 1)}
            onChange={(e) => set("nextSequence", Number(e.target.value))}
            inputMode="numeric"
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {success}
          </p>
        ) : null}

        <div>
          <button
            onClick={submit}
            disabled={busy || !loaded}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
