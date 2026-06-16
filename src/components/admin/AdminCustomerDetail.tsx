"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, FileText, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import type { RelatedInvoice, RelatedReceipt } from "@/lib/business/related-records";
import { PROGRESS_STAGES, type CustomerRollup } from "@/lib/reseller/customer-rollup";

const money = (n: number) => `$${n.toLocaleString()}`;
function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-[var(--muted)]">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>;
}

export function AdminCustomerDetail({
  customer, invoices, receipts, notes,
}: {
  customer: CustomerRollup;
  invoices: RelatedInvoice[];
  receipts: RelatedReceipt[];
  notes: string[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const reached = PROGRESS_STAGES.indexOf(customer.progress);

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/customers", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId: customer.id, action: "add_note", note }) });
      if (res.ok) { setNote(""); router.refresh(); }
    } finally { setBusy(false); }
  }
  async function del() {
    if (!window.confirm("Move this customer to the delete queue?")) return;
    setBusy(true);
    try { await fetch("/api/admin/customers", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId: customer.id, action: "delete" }) }); router.push("/admin/customers"); router.refresh(); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <Link href="/admin/customers" aria-label="Back" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"><ArrowLeft className="size-4" /></Link>
        <div><h1 className="text-xl font-bold tracking-tight">{customer.name}</h1><p className="text-sm text-[var(--muted)]">{customer.reseller} · {customer.country}</p></div>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Progress</CardTitle></CardHeader>
        <CardContent><div className="grid grid-cols-4 gap-2">{PROGRESS_STAGES.map((stage, i) => { const done = i <= reached; return <div key={stage} className="grid gap-1.5"><div className={`h-1.5 rounded-full ${done ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`} /><p className={`text-[11px] ${done ? "font-semibold" : "text-[var(--muted)]"}`}>{stage}</p></div>; })}</div></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Customer summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Detail label="Contract status" value={customer.contractStatus} /><Detail label="Invoice status" value={customer.invoiceStatus} />
              <Detail label="Invoiced total" value={money(customer.invoiceTotal)} /><Detail label="Paid total" value={money(customer.paidTotal)} />
              <Detail label="Balance due" value={customer.balance > 0 ? money(customer.balance) : "Settled"} /><Detail label="Reseller" value={customer.reseller} />
            </CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
            <CardContent className="grid gap-2">{invoices.length === 0 ? <p className="text-sm text-[var(--muted)]">No invoices.</p> : invoices.map((i) => <div key={i.id} className="flex justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="flex items-center gap-1.5 font-semibold"><FileText className="size-3.5 text-[var(--muted)]" />{i.invoiceNumber}</span><span className="text-[var(--muted)]">{i.currency} {i.total.toLocaleString()} · {i.paymentStatus}</span></div>)}</CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Receipts</CardTitle></CardHeader>
            <CardContent className="grid gap-2">{receipts.length === 0 ? <p className="text-sm text-[var(--muted)]">No receipts.</p> : receipts.map((r) => <div key={r.id} className="flex justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="flex items-center gap-1.5 font-semibold"><Receipt className="size-3.5 text-[var(--muted)]" />{r.receiptNumber}</span><span className="text-[var(--muted)]">{r.currency} {r.amount.toLocaleString()} · {r.paymentMethod}</span></div>)}</CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Notes &amp; timeline</CardTitle></CardHeader>
            <CardContent className="grid gap-2">{notes.length === 0 ? <p className="text-sm text-[var(--muted)]">No notes recorded.</p> : notes.map((n, i) => <div key={i} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">{n}</div>)}</CardContent>
          </Card>
        </div>

        <Card className="h-fit"><CardHeader className="pb-2"><CardTitle className="text-base">Admin actions</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Add note"><Textarea aria-label="New note" rows={3} maxLength={500} value={note} placeholder="Record context…" onChange={(e) => setNote(e.target.value)} /></Field>
            <Button variant="secondary" disabled={busy || !note.trim()} onClick={addNote}>Add note</Button>
            <Button variant="danger" disabled={busy} onClick={del}>Delete (to queue)</Button>
            <Link href="/admin/audit-logs" className="text-xs font-semibold text-[var(--brand)]">View audit trail →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
