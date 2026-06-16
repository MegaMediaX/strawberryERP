"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type { PaymentMethod } from "@/lib/phase2-data";

export function AdminPaymentMethodsView({ methods }: { methods: PaymentMethod[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<PaymentMethod | null>(null);
  const [order, setOrder] = useState(0);
  const [reqRef, setReqRef] = useState(false);
  const [reqAtt, setReqAtt] = useState(false);

  async function patch(body: Partial<PaymentMethod>) {
    setBusy(String(body.methodName));
    try { await fetch("/api/admin/accounting/payment-methods", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); router.refresh(); }
    finally { setBusy(null); }
  }
  function openEdit(m: PaymentMethod) { setEdit(m); setOrder(m.displayOrder); setReqRef(m.requiresReference); setReqAtt(m.requiresAttachment); }
  async function saveEdit() {
    if (!edit) return;
    await patch({ methodName: edit.methodName, displayOrder: order, requiresReference: reqRef, requiresAttachment: reqAtt });
    setEdit(null);
  }

  return (
    <div className="grid gap-3">
      {methods.sort((a, b) => a.displayOrder - b.displayOrder).map((m) => (
        <Card key={m.methodName}><CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{m.methodName}</p>
            <p className="flex flex-wrap gap-1.5 pt-1 text-xs text-[var(--muted)]">
              <Badge tone="neutral">{m.countries.length} countries</Badge>
              {m.requiresReference && <Badge tone="neutral">ref required</Badge>}
              {m.requiresAttachment && <Badge tone="neutral">attachment</Badge>}
              <Badge tone="neutral">order {m.displayOrder}</Badge>
            </p>
          </div>
          <Badge tone={m.isActive ? "green" : "neutral"}>{m.isActive ? "Enabled" : "Disabled"}</Badge>
          <button type="button" className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold hover:bg-[var(--background)]" onClick={() => openEdit(m)}>Edit</button>
          <button type="button" disabled={busy === m.methodName} className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold hover:bg-[var(--background)]" onClick={() => patch({ methodName: m.methodName, isActive: !m.isActive })}>{m.isActive ? "Disable" : "Enable"}</button>
        </CardContent></Card>
      ))}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Edit payment method" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <h2 className="text-base font-bold tracking-tight">Edit {edit.methodName}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Display order"><Input aria-label="Display order" type="number" min={0} value={String(order)} onChange={(e) => setOrder(Number(e.target.value))} /></Field>
              <button type="button" role="switch" aria-checked={reqRef} onClick={() => setReqRef((v) => !v)} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm">Requires reference<span className={`relative inline-flex h-5 w-9 rounded-full ${reqRef ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${reqRef ? "left-[18px]" : "left-0.5"}`} /></span></button>
              <button type="button" role="switch" aria-checked={reqAtt} onClick={() => setReqAtt((v) => !v)} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm">Requires attachment<span className={`relative inline-flex h-5 w-9 rounded-full ${reqAtt ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${reqAtt ? "left-[18px]" : "left-0.5"}`} /></span></button>
              <div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setEdit(null)}>Cancel</Button><Button className="flex-1" onClick={saveEdit}>Save</Button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
