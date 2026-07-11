"use client";

import { useState } from "react";
import { Archive, FileText, Mail, Receipt as ReceiptIcon } from "lucide-react";

import { LeadCallScreen } from "@/components/platform/LeadCallScreen";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalRole, PortalUser } from "@/lib/portal-security";
import type { RelatedInvoice, RelatedReceipt } from "@/lib/business/related-records";
import type { TimelineEntry } from "@/lib/sales/timeline-builder";
import type { PortalLead } from "@/lib/ui-data";

function payTone(s: string): "green" | "amber" | "rose" | "neutral" {
  if (s === "Fully Paid") return "green";
  if (s === "Partially Paid") return "amber";
  if (s === "Overdue") return "rose";
  return "neutral";
}

const rowAction = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

export function ResellerLeadDetail({
  lead, users, actingUser, importantDetails, timeline, related, telephonyMode,
}: {
  lead: PortalLead;
  users: PortalUser[];
  actingUser: { id: string; role: PortalRole; countries: string[]; reseller?: string };
  importantDetails: string[];
  timeline: TimelineEntry[];
  related: { invoices: RelatedInvoice[]; receipts: RelatedReceipt[] };
  /** "webrtc" → in-browser softphone; "tinyphone" → CRM dial-queue (matches LeadCallScreen). */
  telephonyMode?: "tinyphone" | "webrtc";
}) {
  const [toast, setToast] = useState<string | null>(null);

  function archiveRequest() {
    // No-DELETE invariant + no archive API: record intent only (dev-store stub).
    setToast("Archive request submitted — your Super Admin will review it.");
    window.setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <LeadCallScreen
          key={lead.id}
          lead={lead}
          users={users}
          actingUser={actingUser}
          importantDetails={importantDetails}
          enableQuickOutcomes
          enableNotesCompose
          timeline={timeline}
          telephonyMode={telephonyMode}
        />
      </div>

      <aside className="grid content-start gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Related invoices</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {related.invoices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No invoices for this company yet.</p>
            ) : related.invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold"><FileText className="size-3.5 shrink-0 text-[var(--muted)]" />{i.invoiceNumber}</p>
                  <p className="text-xs text-[var(--muted)]">{i.currency} {i.total.toLocaleString()}{i.dueDate ? ` · due ${i.dueDate}` : ""}</p>
                </div>
                <Badge tone={payTone(i.paymentStatus)}>{i.paymentStatus}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Related receipts</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {related.receipts.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No receipts recorded yet.</p>
            ) : related.receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold"><ReceiptIcon className="size-3.5 shrink-0 text-[var(--muted)]" />{r.receiptNumber}</p>
                  <p className="text-xs text-[var(--muted)]">{r.currency} {r.amount.toLocaleString()} · {r.paymentMethod}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Admin actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <a href={`mailto:${lead.email}`} className={rowAction}><Mail className="size-4" /> Email contact</a>
            <button
              disabled
              title="Needs Super Admin permission per reseller"
              className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted)] opacity-60"
            >
              Transfer to another reseller
            </button>
            <button onClick={archiveRequest} className={rowAction}><Archive className="size-4" /> Request archive</button>
            <p className="text-[11px] text-[var(--muted)]">Reassign &amp; Convert to customer are in the call panel. Transfer needs Super Admin permission; archiving is reviewed by Super Admin (records are never hard-deleted).</p>
          </CardContent>
        </Card>
      </aside>

      {toast ? (
        <div role="status" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] shadow-[var(--shadow-md)] md:bottom-6">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
