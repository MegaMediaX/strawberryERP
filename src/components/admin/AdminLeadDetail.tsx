"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import type { RelatedInvoice, RelatedReceipt } from "@/lib/business/related-records";
import type { TimelineEntry } from "@/lib/sales/timeline-builder";
import type { PortalLead } from "@/lib/ui-data";
import { formatMoney } from "@/lib/money-ui";

const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;
const action = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--background)]";

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-[var(--muted)]">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>;
}

export function AdminLeadDetail({
  lead, importantDetails, timeline, related, assignees,
}: {
  lead: PortalLead;
  importantDetails: string[];
  timeline: TimelineEntry[];
  related: { invoices: RelatedInvoice[]; receipts: RelatedReceipt[] };
  assignees: string[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function call(body: Record<string, unknown>, after: "refresh" | "list") {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/leads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: lead.id, ...body }) });
      const data = (await res.json()) as { error?: string; data?: { message?: string } };
      if (!res.ok) { setMsg(data.error ?? "Action failed."); setBusy(false); return; }
      if (after === "list") { router.push("/admin/leads"); router.refresh(); }
      else { setMsg(data.data?.message ?? "Done."); router.refresh(); setBusy(false); }
    } catch { setMsg("Network error."); setBusy(false); }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <Link href="/admin/leads" aria-label="Back to leads" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"><ArrowLeft className="size-4" /></Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{lead.company}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]"><span>{lead.reseller} · {lead.country}</span><Badge tone="neutral">{lead.status}</Badge><Badge tone={lead.priority === "VIP" ? "rose" : "neutral"}>{lead.priority}</Badge></p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={tel(lead.phone)} className={action}>Call</a>
        <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={action}>WhatsApp</a>
        <a href={`mailto:${lead.email}`} className={action}>Email</a>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Contact &amp; assignment</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Detail label="Contact" value={`${lead.contact} · ${lead.gender}`} />
              <Detail label="Assigned user" value={lead.assignedTo} />
              <Detail label="Phone" value={lead.phone} /><Detail label="Email" value={lead.email} />
              <Detail label="Source" value={lead.source} /><Detail label="Follow-up" value={lead.followUp || "Unscheduled"} />
              <Detail label="Reseller" value={lead.reseller} /><Detail label="Country" value={lead.country} />
            </CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Important details</CardTitle></CardHeader>
            <CardContent><div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40"><ul className="grid gap-1.5 text-sm text-amber-900 dark:text-amber-100">{importantDetails.map((l, i) => <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{l}</span></li>)}</ul></div></CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{lead.notes.trim() || "No notes recorded."}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><Clock className="size-4 text-[var(--muted)]" /> Timeline</CardTitle></CardHeader>
            <CardContent className="grid gap-2">{timeline.map((t, i) => <div key={i} className="flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2"><span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--brand)]" /><div className="min-w-0"><p className="text-sm font-semibold">{t.label}</p>{t.detail ? <p className="text-xs text-[var(--muted)]">{t.detail}</p> : null}</div></div>)}</CardContent>
          </Card>
          {(related.invoices.length > 0 || related.receipts.length > 0) && (
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Related billing</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {related.invoices.map((i) => <div key={i.id} className="flex justify-between rounded-xl border border-[var(--border)] px-3 py-2"><span className="font-semibold">{i.invoiceNumber}</span><span className="text-[var(--muted)]">{formatMoney(i.total, i.currency)} · {i.paymentStatus}</span></div>)}
                {related.receipts.map((r) => <div key={r.id} className="flex justify-between rounded-xl border border-[var(--border)] px-3 py-2"><span className="font-semibold">{r.receiptNumber}</span><span className="text-[var(--muted)]">{formatMoney(r.amount, r.currency)} · {r.paymentMethod}</span></div>)}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Admin actions panel */}
        <Card className="h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-base">Admin actions</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Reassign to"><Select aria-label="Reassign target" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Select user…</option>{assignees.map((a) => <option key={a}>{a}</option>)}</Select></Field>
            <Button variant="secondary" disabled={busy || !target} onClick={() => call({ action: "reassign", assignedTo: target }, "refresh")}>Reassign</Button>
            <Button variant="secondary" disabled={busy} onClick={() => call({ action: "convert" }, "refresh")}>Convert to customer</Button>
            <Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm("Archive this lead? It moves to the delete queue.")) call({ action: "archive" }, "list"); }}>Archive</Button>
            <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm("Request permanent deletion? It enters the delete queue for review.")) call({ action: "delete" }, "list"); }}>Permanent delete</Button>
            {msg && <p className="text-xs font-semibold text-[var(--muted)]">{msg}</p>}
            <Link href="/admin/audit-logs" className="text-xs font-semibold text-[var(--brand)]">View audit trail →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
