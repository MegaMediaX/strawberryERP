"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatInstant } from "@/lib/datetime-ui";
import { INTEGRATION_SPECS, providerSpec, statusTone, type IntegrationTestResult } from "@/lib/admin/integrations";
import type { IntegrationSetting, IntegrationType } from "@/lib/phase2-data";

type ConfigValue = string | boolean | number;

export function AdminIntegrationForm({ type, setting, timeZone }: { type: IntegrationType; setting: IntegrationSetting; timeZone: string }) {
  const router = useRouter();
  const spec = INTEGRATION_SPECS[type];
  const [provider, setProvider] = useState(setting.provider || spec.providers[0].provider);
  const [config, setConfig] = useState<Record<string, ConfigValue>>({ ...setting.configJson });
  const [enabled, setEnabled] = useState(setting.isEnabled);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<IntegrationTestResult | null>(null);

  const fields = useMemo(() => providerSpec(type, provider).fields, [type, provider]);
  const multiProvider = spec.providers.length > 1;

  function setVal(key: string, v: ConfigValue) {
    setConfig((c) => ({ ...c, [key]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/admin/integrations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ integrationType: type, provider, configJson: config, isEnabled: enabled }) });
      if (res.ok) { setSaved(true); router.refresh(); }
    } finally { setSaving(false); }
  }

  async function test() {
    setTesting(true); setResult(null);
    try {
      // Save first so the test reads the latest config, then run the simulated test.
      await fetch("/api/admin/integrations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ integrationType: type, provider, configJson: config, isEnabled: enabled }) });
      const res = await fetch("/api/admin/integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ integrationType: type, action: "test" }) });
      const data = (await res.json()) as { data?: { result?: IntegrationTestResult } };
      if (data.data?.result) setResult(data.data.result);
      router.refresh();
    } finally { setTesting(false); }
  }

  async function copy(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="grid gap-4">
      <Card><CardContent className="grid gap-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Status</span>
            <Badge tone={statusTone(setting.connectionStatus)}>{setting.connectionStatus}</Badge>
            {setting.lastTestedAt && <span className="text-xs text-[var(--muted)]">last tested {formatInstant(setting.lastTestedAt, timeZone)}</span>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} /> Enabled</label>
        </div>

        {multiProvider && (
          <Field label="Provider">
            <Select aria-label="Provider" value={provider} onChange={(e) => { setProvider(e.target.value); setSaved(false); }}>
              {spec.providers.map((p) => <option key={p.provider}>{p.provider}</option>)}
            </Select>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => {
            const raw = config[f.key];
            const strVal = raw === undefined ? "" : String(raw);
            if (f.type === "checkbox") {
              return <label key={f.key} className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={Boolean(raw)} onChange={(e) => setVal(f.key, e.target.checked)} /> {f.label}</label>;
            }
            if (f.type === "select") {
              return <Field key={f.key} label={f.label}><Select aria-label={f.label} value={strVal} onChange={(e) => setVal(f.key, e.target.value)}>{(f.options ?? []).map((o) => <option key={o}>{o}</option>)}</Select></Field>;
            }
            if (f.readOnly) {
              return (
                <Field key={f.key} label={f.label}>
                  <div className="flex items-center gap-2">
                    <Input aria-label={f.label} value={strVal} readOnly className="bg-[var(--background)] text-[var(--muted)]" />
                    <Button type="button" variant="secondary" className="h-9 shrink-0 px-3" onClick={() => copy(f.key, strVal)}>{copied === f.key ? <Check className="size-4" /> : <Copy className="size-4" />}</Button>
                  </div>
                </Field>
              );
            }
            if (f.type === "password") {
              return (
                <Field key={f.key} label={f.label}>
                  <div className="flex items-center gap-2">
                    <Input aria-label={f.label} type={reveal[f.key] ? "text" : "password"} value={strVal} onChange={(e) => setVal(f.key, e.target.value)} placeholder={f.placeholder} autoComplete="off" />
                    <button type="button" aria-label={reveal[f.key] ? "Hide" : "Show"} className="shrink-0 rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--background)]" onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))}>{reveal[f.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                  </div>
                </Field>
              );
            }
            return <Field key={f.key} label={f.label}><Input aria-label={f.label} type={f.type === "number" ? "number" : "text"} value={strVal} onChange={(e) => setVal(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={f.placeholder} /></Field>;
          })}
        </div>

        <p className="text-xs text-[var(--muted)]">Secrets are masked once saved and never leave the server. The Test button runs a <span className="font-semibold">simulated</span> check — no live messages are sent.</p>

        {result && (
          <div className={`rounded-lg px-3 py-2 text-sm font-medium ${result.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}`}>{result.message}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="mr-1 size-4 animate-spin" /> Saving</> : saved ? <><Check className="mr-1 size-4" /> Saved</> : "Save settings"}</Button>
          <Button variant="secondary" onClick={test} disabled={testing}>{testing ? <><Loader2 className="mr-1 size-4 animate-spin" /> Testing…</> : "Test connection"}</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
