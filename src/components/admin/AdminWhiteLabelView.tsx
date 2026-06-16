"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { BrandingPreview } from "@/components/admin/BrandingPreview";
import { brandingScopeSummary, PLATFORM_MODULES, type WhiteLabelSettings } from "@/lib/admin/white-label";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5">
      <span><span className="text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-[var(--muted)]">{hint}</span>}</span>
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function AdminWhiteLabelView({ settings }: { settings: WhiteLabelSettings }) {
  const router = useRouter();
  const [s, setS] = useState<WhiteLabelSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  function set<K extends keyof WhiteLabelSettings>(k: K, v: WhiteLabelSettings[K]) { setS((p) => ({ ...p, [k]: v })); setSaved(false); }
  function toggleModule(m: string) {
    setS((p) => ({ ...p, enabledModules: p.enabledModules.includes(m) ? p.enabledModules.filter((x) => x !== m) : [...p.enabledModules, m] }));
    setSaved(false);
  }

  async function save() {
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/admin/white-label", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Save failed."); return; }
      setSaved(true); router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="grid gap-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Platform identity</CardTitle></CardHeader>
          <CardContent className="grid gap-3 pt-1 sm:grid-cols-2">
            <Field label="Platform name"><Input aria-label="Platform name" value={s.platformName} onChange={(e) => set("platformName", e.target.value)} /></Field>
            <Field label="Login tagline"><Input aria-label="Login tagline" value={s.loginTagline} onChange={(e) => set("loginTagline", e.target.value)} /></Field>
            <Field label="Global logo URL"><Input aria-label="Logo URL" value={s.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.svg" /></Field>
            <Field label="Favicon URL"><Input aria-label="Favicon URL" value={s.faviconUrl} onChange={(e) => set("faviconUrl", e.target.value)} placeholder="https://…/favicon.ico" /></Field>
            <Field label="Primary color"><div className="flex items-center gap-2"><input type="color" aria-label="Primary color" value={s.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="h-9 w-10 shrink-0 rounded border border-[var(--border)]" /><Input aria-label="Primary color hex" value={s.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} /></div></Field>
            <Field label="Secondary color"><div className="flex items-center gap-2"><input type="color" aria-label="Secondary color" value={s.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} className="h-9 w-10 shrink-0 rounded border border-[var(--border)]" /><Input aria-label="Secondary color hex" value={s.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} /></div></Field>
            <div className="sm:col-span-2"><Field label="Footer text"><Input aria-label="Footer text" value={s.footer} onChange={(e) => set("footer", e.target.value)} /></Field></div>
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Tenant branding rules</CardTitle></CardHeader>
          <CardContent className="grid gap-2 pt-1">
            <p className="text-xs text-[var(--muted)]">Branding cascade: <span className="font-semibold text-[var(--foreground)]">{brandingScopeSummary(s)}</span></p>
            <Toggle label="Allow country branding" hint="Per-country logo + colors override the global brand." checked={s.allowCountryBranding} onChange={(v) => set("allowCountryBranding", v)} />
            <Toggle label="Allow reseller branding" hint="Resellers can apply their own brand within allowed limits." checked={s.allowResellerBranding} onChange={(v) => set("allowResellerBranding", v)} />
            <Toggle label="Custom domain readiness" hint="Expose partner.<reseller>.domain mapping (scaffolding)." checked={s.customDomainReady} onChange={(v) => set("customDomainReady", v)} />
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Module availability</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
            {PLATFORM_MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"><input type="checkbox" checked={s.enabledModules.includes(m)} onChange={() => toggleModule(m)} /> {m}</label>
            ))}
          </CardContent>
        </Card>

        {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
        <div><Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="mr-1 size-4 animate-spin" /> Saving</> : saved ? <><Check className="mr-1 size-4" /> Saved</> : "Save white-label settings"}</Button></div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <BrandingPreview platformName={s.platformName} logoUrl={s.logoUrl} primaryColor={s.primaryColor} secondaryColor={s.secondaryColor} loginTagline={s.loginTagline} footer={s.footer} />
      </div>
    </div>
  );
}
