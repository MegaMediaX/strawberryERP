import Link from "next/link";
import { ArrowLeft, Clock, FileText, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EscalationButton } from "@/components/regional/EscalationModal";
import type { RelatedInvoice, RelatedReceipt } from "@/lib/business/related-records";
import type { TimelineEntry } from "@/lib/sales/timeline-builder";
import type { PortalLead } from "@/lib/ui-data";

const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;
const action = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

function priorityTone(p: string): "rose" | "amber" | "blue" | "neutral" {
  if (p === "VIP" || p === "High") return "rose";
  if (p === "Medium") return "amber";
  if (p === "Low") return "blue";
  return "neutral";
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-[var(--muted)]">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>;
}

export function RegionalLeadDetail({
  lead, importantDetails, timeline, related,
}: {
  lead: PortalLead;
  importantDetails: string[];
  timeline: TimelineEntry[];
  related: { invoices: RelatedInvoice[]; receipts: RelatedReceipt[] };
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <Link href="/regional/leads" aria-label="Back to leads" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"><ArrowLeft className="size-4" /></Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{lead.company}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span>{lead.reseller} · {lead.country}</span>
            <Badge tone="neutral">{lead.status}</Badge>
            <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
            <Badge tone="neutral">read-only</Badge>
          </p>
        </div>
      </div>

      {/* Contact + WhatsApp/Email (hooks-only) + Escalate (§16) */}
      <div className="flex flex-wrap gap-2">
        <a href={tel(lead.phone)} className={action}>Call</a>
        <a href={wa(lead.phone)} target="_blank" rel="noopener noreferrer" className={action}>WhatsApp</a>
        <a href={`mailto:${lead.email}`} className={action}>Email</a>
        <EscalationButton
          context={{ entityType: "Lead", entityId: lead.id, entityLabel: lead.company, country: lead.country, reseller: lead.reseller }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Contact &amp; assignment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Detail label="Contact" value={`${lead.contact} · ${lead.gender}`} />
            <Detail label="Assigned user" value={lead.assignedTo} />
            <Detail label="Phone" value={lead.phone} />
            <Detail label="Email" value={lead.email} />
            <Detail label="Source" value={lead.source} />
            <Detail label="Follow-up" value={lead.followUp || "Unscheduled"} />
            <Detail label="Reseller" value={lead.reseller} />
            <Detail label="Country" value={lead.country} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Important details</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <ul className="grid gap-1.5 text-sm text-amber-900 dark:text-amber-100">
                {importantDetails.map((l, i) => <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{l}</span></li>)}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{lead.notes.trim() || "No notes recorded."}</p></CardContent>
        </Card>

        {/* Prominent timeline (the monitoring focus) */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><Clock className="size-4 text-[var(--muted)]" /> Timeline</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--brand)]" />
                <div className="min-w-0"><p className="text-sm font-semibold">{t.label}</p>{t.detail ? <p className="text-xs text-[var(--muted)]">{t.detail}</p> : null}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(related.invoices.length > 0 || related.receipts.length > 0) ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Related billing</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {related.invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="flex items-center gap-1.5 font-semibold"><FileText className="size-3.5 text-[var(--muted)]" />{i.invoiceNumber}</span><span className="text-[var(--muted)]">{i.currency} {i.total.toLocaleString()} · {i.paymentStatus}</span></div>
            ))}
            {related.receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="flex items-center gap-1.5 font-semibold"><Receipt className="size-3.5 text-[var(--muted)]" />{r.receiptNumber}</span><span className="text-[var(--muted)]">{r.currency} {r.amount.toLocaleString()} · {r.paymentMethod}</span></div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-[var(--muted)]">Regional monitoring view — read-only. The reseller and Super Admin own edits, reassignment, and conversion. Escalation ships in the next slice.</p>
    </div>
  );
}
