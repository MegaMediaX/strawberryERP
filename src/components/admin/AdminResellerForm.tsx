"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import type { Reseller } from "@/lib/business/reseller-defaults";

const TRIGGERS = ["Invoice Created", "Deposit Paid", "Fully Paid"] as const;
const VISIBILITY = ["All Countries", "Assigned Countries"] as const;

/**
 * §10 reseller edit form (the 8-step CREATE wizard ships in slice 4b). Edits the
 * existing reseller's countries, currency, commission, and visibility; saves via
 * PATCH /api/admin/resellers (validated + audited).
 */
export function AdminResellerForm({
  initial,
  currencies,
  countries,
}: {
  initial: Reseller;
  currencies: { code: string; name: string }[];
  countries: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial.countries);
  const [currency, setCurrency] = useState(initial.defaultCurrency);
  const [pct, setPct] = useState(String(initial.defaultCommissionPercentage));
  const [trigger, setTrigger] = useState(initial.defaultCommissionTrigger);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  function toggleCountry(c: string) {
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  async function save() {
    setStatus("saving"); setMessage("");
    try {
      const res = await fetch("/api/admin/resellers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: initial.name, countries: selected, defaultCurrency: currency, defaultCommissionPercentage: Number(pct), defaultCommissionTrigger: trigger, visibility }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setStatus("error"); setMessage(data.error ?? "Save failed."); return; }
      router.push("/admin/resellers");
      router.refresh();
    } catch { setStatus("error"); setMessage("Network error — reseller not saved."); }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Edit {initial.name}</h1>
        <p className="text-sm text-[var(--muted)]">Countries, currency, commission, and visibility. Branding ships in the White-Label slice.</p>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-5">
          <fieldset className="grid gap-1.5">
            <legend className="text-xs font-medium text-[var(--muted)]">Countries</legend>
            <div className="flex flex-wrap gap-2">
              {countries.map((c) => {
                const on = selected.includes(c);
                return (
                  <button key={c} type="button" aria-pressed={on} onClick={() => toggleCountry(c)}
                    className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${on ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{c}</button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default currency">
              <Select aria-label="Default currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </Field>
            <Field label="Commission %">
              <Input aria-label="Commission percentage" type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} />
            </Field>
            <Field label="Commission trigger">
              <Select aria-label="Commission trigger" value={trigger} onChange={(e) => setTrigger(e.target.value as Reseller["defaultCommissionTrigger"])}>
                {TRIGGERS.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Customer visibility">
              <Select aria-label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as Reseller["visibility"])}>
                {VISIBILITY.map((v) => <option key={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {status === "error" && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{message}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/admin/resellers")} disabled={status === "saving"}>Cancel</Button>
        <Button onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
