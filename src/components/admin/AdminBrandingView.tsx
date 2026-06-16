"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { BrandingPreview } from "@/components/admin/BrandingPreview";
import { defaultWhiteLabel, type WhiteLabelSettings } from "@/lib/admin/white-label";

type Brand = Pick<WhiteLabelSettings, "platformName" | "logoUrl" | "primaryColor" | "secondaryColor" | "loginTagline" | "footer">;

export function AdminBrandingView({ settings }: { settings: WhiteLabelSettings }) {
  const router = useRouter();
  const [b, setB] = useState<Brand>({
    platformName: settings.platformName, logoUrl: settings.logoUrl,
    primaryColor: settings.primaryColor, secondaryColor: settings.secondaryColor,
    loginTagline: settings.loginTagline, footer: settings.footer,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  function set<K extends keyof Brand>(k: K, v: Brand[K]) { setB((p) => ({ ...p, [k]: v })); setSaved(false); }
  function reset() { setB({ platformName: b.platformName, logoUrl: "", primaryColor: defaultWhiteLabel.primaryColor, secondaryColor: defaultWhiteLabel.secondaryColor, loginTagline: b.loginTagline, footer: defaultWhiteLabel.footer }); setSaved(false); }

  async function save() {
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/admin/white-label", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Save failed."); return; }
      setSaved(true); router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <Card className="lg:sticky lg:top-4 lg:self-start"><CardHeader className="pb-2"><CardTitle className="text-base">Brand</CardTitle></CardHeader>
        <CardContent className="grid gap-3 pt-1">
          <Field label="Brand name"><Input aria-label="Brand name" value={b.platformName} onChange={(e) => set("platformName", e.target.value)} /></Field>
          <Field label="Logo URL"><Input aria-label="Logo URL" value={b.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.svg" /></Field>
          <Field label="Tagline"><Input aria-label="Tagline" value={b.loginTagline} onChange={(e) => set("loginTagline", e.target.value)} /></Field>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Field label="Primary"><div className="flex items-center gap-2"><input type="color" aria-label="Primary color" value={b.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="h-9 w-10 shrink-0 rounded border border-[var(--border)]" /><Input aria-label="Primary hex" value={b.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} /></div></Field>
            <Field label="Secondary"><div className="flex items-center gap-2"><input type="color" aria-label="Secondary color" value={b.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} className="h-9 w-10 shrink-0 rounded border border-[var(--border)]" /><Input aria-label="Secondary hex" value={b.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} /></div></Field>
          </div>
          <Field label="Footer"><Input aria-label="Footer" value={b.footer} onChange={(e) => set("footer", e.target.value)} /></Field>
          {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">{saving ? <><Loader2 className="mr-1 size-4 animate-spin" /> Saving</> : saved ? <><Check className="mr-1 size-4" /> Saved</> : "Save brand"}</Button>
            <Button variant="secondary" onClick={reset}><RotateCcw className="mr-1 size-4" /> Reset</Button>
          </div>
          <p className="text-xs text-[var(--muted)]">The preview updates live as you type. Saving applies the global brand; country/reseller overrides are governed by White-Label rules.</p>
        </CardContent>
      </Card>

      <BrandingPreview platformName={b.platformName} logoUrl={b.logoUrl} primaryColor={b.primaryColor} secondaryColor={b.secondaryColor} loginTagline={b.loginTagline} footer={b.footer} />
    </div>
  );
}
