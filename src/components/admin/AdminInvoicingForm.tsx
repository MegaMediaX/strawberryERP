"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { invoicingPreview } from "@/lib/admin/accounting";
import type { InvoiceDocSettings } from "@/lib/dev-store";

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)]">
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} /></span>
    </button>
  );
}

export function AdminInvoicingForm({
  initialMode, initialPrefix, sampleCountryPrefix, initialDoc,
}: {
  initialMode: string;
  initialPrefix: string;
  sampleCountryPrefix: string;
  initialDoc: InvoiceDocSettings;
}) {
  const [mode, setMode] = useState(initialMode);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [doc, setDoc] = useState<InvoiceDocSettings>(initialDoc);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const preview = useMemo(() => invoicingPreview(mode, prefix, sampleCountryPrefix), [mode, prefix, sampleCountryPrefix]);
  const modeChanged = mode !== initialMode;
  const setT = (k: keyof InvoiceDocSettings) => setDoc((d) => ({ ...d, [k]: !d[k] }));

  async function save() {
    setStatus("saving"); setMessage("");
    try {
      const res = await fetch("/api/admin/accounting/invoicing", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, prefix, ...doc }) });
      const data = (await res.json()) as { error?: string; data?: { message?: string } };
      if (!res.ok) { setStatus("error"); setMessage(data.error ?? "Save failed."); return; }
      setStatus("saved"); setMessage(data.data?.message ?? "Saved.");
    } catch { setStatus("error"); setMessage("Network error."); }
  }

  return (
    <div className="grid gap-4">
      <Card><CardContent className="grid gap-4 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Invoice numbering">
            <Select aria-label="Numbering mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="Global">Global (INV-0001)</option>
              <option value="Country Prefix">Country-based (LB-INV-0001)</option>
            </Select>
          </Field>
          <Field label="Global prefix"><Input aria-label="Global prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} /></Field>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">Next invoice preview</p>
          <p className="font-mono text-sm font-semibold" aria-label="Invoice preview">{preview.example}</p>
        </div>
        {modeChanged && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Changing invoice numbering may affect future invoice references. Existing invoices will not be changed.</p>
        )}
      </CardContent></Card>

      <Card><CardContent className="grid gap-3 pt-5">
        <Field label="PDF template">
          <Select aria-label="PDF template" value={doc.pdfTemplate} onChange={(e) => setDoc((d) => ({ ...d, pdfTemplate: e.target.value }))}><option>Default</option><option>Compact</option><option>Detailed</option></Select>
        </Field>
        <Toggle on={doc.qrCode} label="Show QR code on invoices" onClick={() => setT("qrCode")} />
        <Toggle on={doc.paymentLink} label="Include payment link" onClick={() => setT("paymentLink")} />
        <Toggle on={doc.whatsappShare} label="Allow WhatsApp share" onClick={() => setT("whatsappShare")} />
        <Toggle on={doc.emailSend} label="Allow email send" onClick={() => setT("emailSend")} />
        <Field label="Footer text"><Input aria-label="Footer text" value={doc.footer} onChange={(e) => setDoc((d) => ({ ...d, footer: e.target.value }))} /></Field>
      </CardContent></Card>

      {message && <p className={`text-xs font-semibold ${status === "error" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{message}</p>}
      <div><Button onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save invoicing settings"}</Button></div>
    </div>
  );
}
