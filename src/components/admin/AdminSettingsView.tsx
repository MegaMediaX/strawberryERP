"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  CAPABILITY_LEVELS,
  impactPreview,
  MANAGED_ROLES,
  PERMISSION_GROUPS,
  type Capability,
  type PermissionMatrix,
} from "@/lib/admin/permission-matrix";
import {
  AVAILABLE_LANGUAGES,
  CURRENCY_DISPLAYS,
  DATE_FORMATS,
  NUMBER_FORMATS,
  type PlatformSettings,
} from "@/lib/admin/platform-settings";

const TABS = [
  { key: "general", label: "General" },
  { key: "roles", label: "Roles & Permissions" },
  { key: "localization", label: "Localization" },
  { key: "security", label: "Security" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function SaveBtn({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return <Button onClick={onClick} disabled={saving}>{saving ? <><Loader2 className="mr-1 size-4 animate-spin" /> Saving</> : saved ? <><Check className="mr-1 size-4" /> Saved</> : "Save changes"}</Button>;
}

export function AdminSettingsView({ settings, matrix }: { settings: PlatformSettings; matrix: PermissionMatrix }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("general");
  const [general, setGeneral] = useState(settings.general);
  const [loc, setLoc] = useState(settings.localization);
  const [sec, setSec] = useState(settings.security);
  const [perm, setPerm] = useState<PermissionMatrix>(matrix);
  const [busy, setBusy] = useState(false);
  const [savedTab, setSavedTab] = useState<Tab | null>(null);
  const [err, setErr] = useState("");

  async function saveSection(section: "general" | "localization" | "security", value: unknown) {
    setErr(""); setBusy(true); setSavedTab(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ section, value }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Save failed."); return; }
      setSavedTab(tab); router.refresh();
    } finally { setBusy(false); }
  }
  async function savePermissions() {
    setErr(""); setBusy(true); setSavedTab(null);
    try {
      const res = await fetch("/api/admin/permissions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(perm) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Save failed."); return; }
      setSavedTab("roles"); router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTab(t.key); setErr(""); }} aria-current={tab === t.key ? "page" : undefined}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${tab === t.key ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{t.label}</button>
        ))}
      </nav>

      {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}

      {tab === "general" && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">General</CardTitle></CardHeader>
          <CardContent className="grid gap-3 pt-1 sm:grid-cols-2">
            <Field label="Default timezone"><Input aria-label="Default timezone" value={general.defaultTimezone} onChange={(e) => setGeneral((g) => ({ ...g, defaultTimezone: e.target.value }))} /></Field>
            <Field label="Default currency"><Input aria-label="Default currency" value={general.defaultCurrency} onChange={(e) => setGeneral((g) => ({ ...g, defaultCurrency: e.target.value }))} /></Field>
            <Field label="Date format"><Select aria-label="Date format" value={general.dateFormat} onChange={(e) => setGeneral((g) => ({ ...g, dateFormat: e.target.value }))}>{DATE_FORMATS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="Support email"><Input aria-label="Support email" value={general.supportEmail} onChange={(e) => setGeneral((g) => ({ ...g, supportEmail: e.target.value }))} /></Field>
            <div className="sm:col-span-2"><SaveBtn saving={busy} saved={savedTab === "general"} onClick={() => saveSection("general", general)} /></div>
          </CardContent>
        </Card>
      )}

      {tab === "roles" && (
        <div className="grid gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Roles &amp; Permissions</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto pt-1">
              <p className="mb-3 text-xs text-[var(--muted)]">Control what each role can see and do — in plain language. The Super Admin always has full access.</p>
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="py-3 pr-4 font-semibold">Area</th>
                  {MANAGED_ROLES.map((r) => <th key={r} className="py-3 pr-4 font-semibold">{r}</th>)}
                </tr></thead>
                <tbody>
                  {PERMISSION_GROUPS.map((g) => (
                    <tr key={g} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 pr-4 align-middle font-medium">{g}</td>
                      {MANAGED_ROLES.map((r) => (
                        <td key={r} className="py-2.5 pr-4 align-middle">
                          <Select aria-label={`${r} ${g}`} value={perm[r][g]} onChange={(e) => setPerm((p) => ({ ...p, [r]: { ...p[r], [g]: e.target.value as Capability } }))}>
                            {CAPABILITY_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Impact preview</CardTitle></CardHeader>
            <CardContent className="grid gap-3 pt-1 sm:grid-cols-3">
              {MANAGED_ROLES.map((r) => (
                <div key={r} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-sm font-semibold">{r}</p>
                  <ul className="mt-1 grid gap-1 text-xs text-[var(--muted)]">
                    {impactPreview(perm, r).map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
          <div><SaveBtn saving={busy} saved={savedTab === "roles"} onClick={savePermissions} /></div>
        </div>
      )}

      {tab === "localization" && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Localization</CardTitle></CardHeader>
          <CardContent className="grid gap-3 pt-1">
            <div><span className="text-xs font-medium">Enabled languages</span><div className="mt-1 flex flex-wrap gap-2">{AVAILABLE_LANGUAGES.map((lang) => (
              <label key={lang} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm"><input type="checkbox" checked={loc.enabledLanguages.includes(lang)} onChange={() => setLoc((l) => ({ ...l, enabledLanguages: l.enabledLanguages.includes(lang) ? l.enabledLanguages.filter((x) => x !== lang) : [...l.enabledLanguages, lang] }))} /> {lang}</label>
            ))}</div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default language"><Select aria-label="Default language" value={loc.defaultLanguage} onChange={(e) => setLoc((l) => ({ ...l, defaultLanguage: e.target.value }))}>{loc.enabledLanguages.map((lang) => <option key={lang}>{lang}</option>)}</Select></Field>
              <Field label="Number format"><Select aria-label="Number format" value={loc.numberFormat} onChange={(e) => setLoc((l) => ({ ...l, numberFormat: e.target.value }))}>{NUMBER_FORMATS.map((n) => <option key={n}>{n}</option>)}</Select></Field>
              <Field label="Currency display"><Select aria-label="Currency display" value={loc.currencyDisplay} onChange={(e) => setLoc((l) => ({ ...l, currencyDisplay: e.target.value }))}>{CURRENCY_DISPLAYS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={loc.rtlSupport} onChange={(e) => setLoc((l) => ({ ...l, rtlSupport: e.target.checked }))} /> RTL support (Arabic)</label>
            </div>
            <div><SaveBtn saving={busy} saved={savedTab === "localization"} onClick={() => saveSection("localization", loc)} /></div>
          </CardContent>
        </Card>
      )}

      {tab === "security" && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Security</CardTitle></CardHeader>
          <CardContent className="grid gap-3 pt-1">
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Danger zone — tightening these can lock users out. Changes are audit-logged.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Min password length"><Input aria-label="Min password length" type="number" min={8} value={sec.minPasswordLength} onChange={(e) => setSec((s) => ({ ...s, minPasswordLength: Number(e.target.value) }))} /></Field>
              <Field label="Session timeout (minutes)"><Input aria-label="Session timeout" type="number" min={5} value={sec.sessionTimeoutMinutes} onChange={(e) => setSec((s) => ({ ...s, sessionTimeoutMinutes: Number(e.target.value) }))} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sec.requireNumber} onChange={(e) => setSec((s) => ({ ...s, requireNumber: e.target.checked }))} /> Require a number in passwords</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sec.requireSymbol} onChange={(e) => setSec((s) => ({ ...s, requireSymbol: e.target.checked }))} /> Require a symbol in passwords</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sec.loginAlerts} onChange={(e) => setSec((s) => ({ ...s, loginAlerts: e.target.checked }))} /> Email alerts on new logins</label>
            </div>
            <Field label="Allowed IPs (comma-separated, optional)"><Input aria-label="Allowed IPs" value={sec.allowedIps.join(", ")} onChange={(e) => setSec((s) => ({ ...s, allowedIps: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))} placeholder="203.0.113.10, 198.51.100.4" /></Field>
            <p className="text-xs text-[var(--muted)]">2FA (authenticator app) is enforced separately and enabled per user.</p>
            <div><SaveBtn saving={busy} saved={savedTab === "security"} onClick={() => saveSection("security", sec)} /></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
