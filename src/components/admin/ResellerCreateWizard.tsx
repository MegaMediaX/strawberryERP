"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  emptyWizardState, validateWizardStep, WIZARD_STEPS,
  type ResellerWizardState, type VisibilityRules, type WizardContext,
} from "@/lib/admin/reseller-wizard";

const VIS_LABELS: { key: keyof VisibilityRules; label: string }[] = [
  { key: "customersAcrossCountries", label: "See customers across their countries" },
  { key: "usersSeeAssignedLeadsOnly", label: "Sales users see only their assigned leads" },
  { key: "adminSeesAllLeads", label: "Reseller admin sees all reseller leads" },
  { key: "leadsTransfer", label: "Allow leads to transfer to/from this reseller" },
  { key: "invoicesCreated", label: "Allow invoices to be created" },
  { key: "contractsUploaded", label: "Allow contracts to be uploaded" },
  { key: "driveContracts", label: "Use Google Drive for contract storage" },
];

function Pill({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${on ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{label}</button>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)]">
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} /></span>
    </button>
  );
}

export function ResellerCreateWizard({ countries, currencies, paymentMethods }: { countries: string[]; currencies: { code: string; name: string }[]; paymentMethods: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [s, setS] = useState<ResellerWizardState>(emptyWizardState);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  const ctx: WizardContext = useMemo(() => ({ existingResellerNames: [], existingUserEmails: [], validCurrencyCodes: currencies.map((c) => c.code) }), [currencies]);
  const set = <K extends keyof ResellerWizardState>(k: K, v: ResellerWizardState[K]) => setS((p) => ({ ...p, [k]: v }));
  const toggleIn = (k: "countries" | "commissionCountries" | "currencies" | "paymentMethods", v: string) =>
    setS((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  function next() {
    const e = validateWizardStep(step, s, ctx);
    if (e) { setError(e); return; }
    setError(""); setStep((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  }
  function back() { setError(""); setStep((i) => Math.max(i - 1, 0)); }

  async function create() {
    setStatus("saving"); setError("");
    try {
      const res = await fetch("/api/admin/resellers/wizard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setStatus("idle"); setError(data.error ?? "Create failed."); return; }
      router.push("/admin/resellers"); router.refresh();
    } catch { setStatus("idle"); setError("Network error — reseller not created."); }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Add reseller</h1>
        <p className="text-sm text-[var(--muted)]">Step {step + 1} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step]}</p>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap gap-1.5" aria-label="Wizard steps">
        {WIZARD_STEPS.map((label, i) => (
          <span key={label} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${i === step ? "bg-[var(--brand)] text-white" : i < step ? "bg-[var(--brand-soft)] text-[var(--brand-hover)]" : "border border-[var(--border)] text-[var(--muted)]"}`}>
            {i < step ? <Check className="size-3" /> : `${i + 1}`} {label}
          </span>
        ))}
      </div>

      <Card><CardContent className="grid gap-4 pt-5">
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reseller name"><Input aria-label="Reseller name" value={s.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Legal name (optional)"><Input aria-label="Legal name" value={s.legalName} onChange={(e) => set("legalName", e.target.value)} /></Field>
            <Field label="Contact email"><Input aria-label="Contact email" value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Phone"><Input aria-label="Phone" value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Notes (optional)"><Textarea aria-label="Notes" rows={2} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
          </div>
        )}
        {step === 1 && (
          <fieldset className="grid gap-2"><legend className="text-xs font-medium text-[var(--muted)]">Operating countries</legend>
            <div className="flex flex-wrap gap-2">{countries.map((c) => <Pill key={c} on={s.countries.includes(c)} label={c} onClick={() => toggleIn("countries", c)} />)}</div>
          </fieldset>
        )}
        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Admin first name"><Input aria-label="Admin first name" value={s.adminFirstName} onChange={(e) => set("adminFirstName", e.target.value)} /></Field>
            <Field label="Admin last name"><Input aria-label="Admin last name" value={s.adminLastName} onChange={(e) => set("adminLastName", e.target.value)} /></Field>
            <Field label="Admin email"><Input aria-label="Admin email" value={s.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} /></Field>
            <Field label="Admin phone"><Input aria-label="Admin phone" value={s.adminPhone} onChange={(e) => set("adminPhone", e.target.value)} /></Field>
            <Field label="Temporary password"><Input aria-label="Admin password" type="password" value={s.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} /></Field>
            <p className="self-end text-xs text-[var(--muted)]">Role: Reseller Admin · scoped to the selected countries.</p>
          </div>
        )}
        {step === 3 && (
          <div className="grid gap-2">{VIS_LABELS.map((v) => <Toggle key={v.key} on={s.visibility[v.key]} label={v.label} onClick={() => set("visibility", { ...s.visibility, [v.key]: !s.visibility[v.key] })} />)}</div>
        )}
        {step === 4 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Branding mode"><Select aria-label="Branding mode" value={s.branding.mode} onChange={(e) => set("branding", { ...s.branding, mode: e.target.value as "Global" | "Country" | "Reseller" })}><option>Global</option><option>Country</option><option>Reseller</option></Select></Field>
            <Field label="Logo URL"><Input aria-label="Logo URL" value={s.branding.logoUrl} onChange={(e) => set("branding", { ...s.branding, logoUrl: e.target.value })} /></Field>
            <Field label="Primary color"><Input aria-label="Primary color" placeholder="#4f46e5" value={s.branding.primaryColor} onChange={(e) => set("branding", { ...s.branding, primaryColor: e.target.value })} /></Field>
            <Field label="Secondary color"><Input aria-label="Secondary color" value={s.branding.secondaryColor} onChange={(e) => set("branding", { ...s.branding, secondaryColor: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Footer text"><Input aria-label="Footer text" value={s.branding.footer} onChange={(e) => set("branding", { ...s.branding, footer: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Toggle on={s.branding.allowResellerCustomize} label="Allow the reseller admin to customise branding" onClick={() => set("branding", { ...s.branding, allowResellerCustomize: !s.branding.allowResellerCustomize })} /></div>
            <p className="sm:col-span-2 text-xs text-[var(--muted)]">Live branding preview ships in the White-Label slice — settings are captured now.</p>
          </div>
        )}
        {step === 5 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Commission %"><Input aria-label="Commission percentage" type="number" min={0} max={100} value={String(s.commissionPercentage)} onChange={(e) => set("commissionPercentage", Number(e.target.value))} /></Field>
            <Field label="Trigger"><Select aria-label="Commission trigger" value={s.commissionTrigger} onChange={(e) => set("commissionTrigger", e.target.value as ResellerWizardState["commissionTrigger"])}><option>Invoice Created</option><option>Deposit Paid</option><option>Fully Paid</option></Select></Field>
            <div className="sm:col-span-2"><fieldset className="grid gap-2"><legend className="text-xs font-medium text-[var(--muted)]">Applies to countries</legend><div className="flex flex-wrap gap-2">{s.countries.map((c) => <Pill key={c} on={s.commissionCountries.includes(c)} label={c} onClick={() => toggleIn("commissionCountries", c)} />)}</div></fieldset></div>
          </div>
        )}
        {step === 6 && (
          <div className="grid gap-4">
            <fieldset className="grid gap-2"><legend className="text-xs font-medium text-[var(--muted)]">Allowed currencies</legend><div className="flex flex-wrap gap-2">{currencies.map((c) => <Pill key={c.code} on={s.currencies.includes(c.code)} label={c.code} onClick={() => toggleIn("currencies", c.code)} />)}</div></fieldset>
            <Field label="Default currency"><Select aria-label="Default currency" value={s.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value)}><option value="">Select…</option>{s.currencies.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <fieldset className="grid gap-2"><legend className="text-xs font-medium text-[var(--muted)]">Allowed payment methods</legend><div className="flex flex-wrap gap-2">{paymentMethods.map((m) => <Pill key={m} on={s.paymentMethods.includes(m)} label={m} onClick={() => toggleIn("paymentMethods", m)} />)}</div></fieldset>
          </div>
        )}
        {step === 7 && (
          <dl className="grid gap-2 text-sm">
            <Row k="Reseller" v={`${s.name}${s.legalName ? ` (${s.legalName})` : ""}`} />
            <Row k="Contact" v={`${s.email}${s.phone ? ` · ${s.phone}` : ""}`} />
            <Row k="Countries" v={s.countries.join(", ") || "—"} />
            <Row k="Admin user" v={`${s.adminFirstName} ${s.adminLastName} · ${s.adminEmail}`} />
            <Row k="Commission" v={`${s.commissionPercentage}% on ${s.commissionTrigger}`} />
            <Row k="Currencies" v={`${s.currencies.join(", ") || "—"} (default ${s.defaultCurrency || "—"})`} />
            <Row k="Payment methods" v={s.paymentMethods.join(", ") || "—"} />
            <Row k="Branding" v={`${s.branding.mode}${s.branding.allowResellerCustomize ? " · reseller-customisable" : ""}`} />
            <Row k="Visibility" v={`${VIS_LABELS.filter((v) => s.visibility[v.key]).length} of ${VIS_LABELS.length} enabled`} />
          </dl>
        )}
      </CardContent></Card>

      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex gap-2">
        {step > 0 && <Button variant="secondary" onClick={back} disabled={status === "saving"}>Back</Button>}
        <Button variant="secondary" onClick={() => router.push("/admin/resellers")} disabled={status === "saving"}>Cancel</Button>
        <div className="flex-1" />
        {step < WIZARD_STEPS.length - 1 ? <Button onClick={next}>Next</Button> : <Button onClick={create} disabled={status === "saving"}>{status === "saving" ? "Creating…" : "Create reseller"}</Button>}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2"><dt className="text-[var(--muted)]">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}
