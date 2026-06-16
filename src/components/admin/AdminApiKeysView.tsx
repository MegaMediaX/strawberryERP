"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { apiKeyStatus, SCOPE_MODULES, type ApiKeyStatus } from "@/lib/admin/api-center";
import type { ApiKeyRecord, ApiScope } from "@/lib/phase2-data";

const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : "never");
const MODULES = SCOPE_MODULES;

function statusTone(s: ApiKeyStatus): "green" | "amber" | "neutral" {
  if (s === "Active") return "green";
  if (s === "Expired") return "amber";
  return "neutral";
}

type SafeKey = Omit<ApiKeyRecord, "keyHash">;

export function AdminApiKeysView({ keys }: { keys: SafeKey[] }) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; plainTextKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({ keyName: "", description: "", expiresAt: "2026-12-31", rateLimitPerMinute: "60", ipWhitelist: "" });
  const [scopes, setScopes] = useState<Set<ApiScope>>(new Set(["read:leads"]));

  function toggleScope(s: ApiScope) {
    setScopes((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  }

  async function generate() {
    setErr("");
    setBusy(true);
    try {
      const selected = [...scopes];
      const readAccess = selected.some((s) => s.startsWith("read:"));
      const writeAccess = selected.some((s) => s.startsWith("write:"));
      const res = await fetch("/api/admin/api-keys", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keyName: form.keyName, description: form.description, scopes: selected,
          readAccess, writeAccess, expiresAt: form.expiresAt,
          rateLimitPerMinute: Number(form.rateLimitPerMinute),
          ipWhitelist: form.ipWhitelist.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = (await res.json()) as { error?: string; data?: { plainTextKey?: string; key?: { keyName: string } } };
      if (!res.ok) { setErr(data.error ?? "Generation failed."); return; }
      setOpen(false);
      setCreated({ name: form.keyName, plainTextKey: data.data?.plainTextKey ?? "" });
      setForm({ keyName: "", description: "", expiresAt: "2026-12-31", rateLimitPerMinute: "60", ipWhitelist: "" });
      setScopes(new Set(["read:leads"]));
      router.refresh();
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/api-keys", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "revoke" }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function copyKey() {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.plainTextKey); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">Read · Create · Update scopes only. <span className="font-semibold text-[var(--foreground)]">Delete is never available through the API.</span></p>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"><Plus className="size-4" /> Generate key</button>
      </div>

      {/* Once-shown plaintext key banner (§43 copy confirmation) */}
      {created && (
        <Card className="border-emerald-300 dark:border-emerald-800">
          <CardContent className="grid gap-2 pt-5">
            <p className="text-sm font-semibold">API key “{created.name}” generated — copy it now, it won’t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-[var(--background)] px-3 py-2 font-mono text-xs">{created.plainTextKey}</code>
              <Button variant="secondary" className="h-9 shrink-0 px-3" onClick={copyKey}>{copied ? <><Check className="mr-1 size-4" /> Copied</> : <><Copy className="mr-1 size-4" /> Copy</>}</Button>
            </div>
            <button type="button" onClick={() => setCreated(null)} className="justify-self-start text-xs font-semibold text-[var(--muted)] hover:underline">Dismiss</button>
          </CardContent>
        </Card>
      )}

      {keys.length === 0 ? <EmptyState title="No API keys yet" description="Generate a key to let an integration read or write platform data." /> : (
        <Card><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Name", "Prefix", "Scopes", "Rate/min", "Expires", "Last used", "Status", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {keys.map((k) => {
                const status = apiKeyStatus(k, now);
                return (
                  <tr key={k.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 align-middle"><div className="flex items-center gap-2"><KeyRound className="size-4 text-[var(--muted)]" /><span className="font-medium">{k.keyName}</span></div></td>
                    <td className="py-3 pr-4 align-middle"><code className="font-mono text-xs text-[var(--muted)]">{k.prefix}…</code></td>
                    <td className="py-3 pr-4 align-middle text-[var(--muted)]">{k.scopes.length} scope{k.scopes.length === 1 ? "" : "s"}</td>
                    <td className="py-3 pr-4 align-middle">{k.rateLimitPerMinute}</td>
                    <td className="py-3 pr-4 align-middle text-[var(--muted)]">{fmtDate(k.expiresAt)}</td>
                    <td className="py-3 pr-4 align-middle text-[var(--muted)]">{fmtDate(k.lastUsedAt)}</td>
                    <td className="py-3 pr-4 align-middle"><Badge tone={statusTone(status)}>{status}</Badge></td>
                    <td className="py-3 pr-4 align-middle">{status === "Revoked" ? <span className="text-xs text-[var(--muted)]">—</span> : <Button variant="secondary" className="h-8 px-2.5 text-xs" disabled={busy} onClick={() => revoke(k.id)}>Revoke</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {/* Generate modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Generate API key" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <h2 className="text-base font-bold tracking-tight">Generate API key</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Key name"><Input aria-label="Key name" value={form.keyName} onChange={(e) => setForm((f) => ({ ...f, keyName: e.target.value }))} placeholder="Partner sync" /></Field>
              <Field label="Description"><Input aria-label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
              <Field label="Expires"><Input aria-label="Expires" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} /></Field>
              <Field label="Rate limit / min"><Input aria-label="Rate limit" type="number" min={1} value={form.rateLimitPerMinute} onChange={(e) => setForm((f) => ({ ...f, rateLimitPerMinute: e.target.value }))} /></Field>
              <div className="sm:col-span-2"><Field label="IP whitelist (comma-separated, optional)"><Input aria-label="IP whitelist" value={form.ipWhitelist} onChange={(e) => setForm((f) => ({ ...f, ipWhitelist: e.target.value }))} placeholder="203.0.113.10" /></Field></div>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Permissions (read · create · update only)</p>
            <div className="mt-2 grid gap-1.5">
              {MODULES.map((m) => (
                <div key={m.module} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                  <span className="text-sm font-medium capitalize">{m.module}</span>
                  <div className="flex gap-3 text-xs">
                    {m.read && <label className="flex items-center gap-1.5"><input type="checkbox" checked={scopes.has(m.read)} onChange={() => toggleScope(m.read!)} /> Read</label>}
                    {m.write && <label className="flex items-center gap-1.5"><input type="checkbox" checked={scopes.has(m.write)} onChange={() => toggleScope(m.write!)} /> Write</label>}
                    {!m.write && <span className="text-[var(--muted)]">read-only</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Delete operations are not available through the API.</p>

            {err && <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
            <div className="mt-4 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button><Button className="flex-1" disabled={busy} onClick={generate}>Generate</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
