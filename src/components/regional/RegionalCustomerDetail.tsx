import Link from "next/link";
import { ArrowLeft, FileText, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EscalationButton } from "@/components/regional/EscalationModal";
import type { RelatedInvoice, RelatedReceipt } from "@/lib/business/related-records";
import { PROGRESS_STAGES, type CustomerRollup } from "@/lib/reseller/customer-rollup";

const action = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";
const money = (n: number) => `$${n.toLocaleString()}`;
const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-[var(--muted)]">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>;
}

export function RegionalCustomerDetail({
  customer,
  invoices,
  receipts,
  phone,
}: {
  customer: CustomerRollup;
  invoices: RelatedInvoice[];
  receipts: RelatedReceipt[];
  phone?: string;
}) {
  const reachedIndex = PROGRESS_STAGES.indexOf(customer.progress);

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <Link href="/regional/customers" aria-label="Back to customers" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"><ArrowLeft className="size-4" /></Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{customer.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span>{customer.reseller} · {customer.country}</span>
            <Badge tone="neutral">read-only</Badge>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {phone ? <a href={wa(phone)} target="_blank" rel="noopener noreferrer" className={action}>WhatsApp</a> : null}
        <EscalationButton
          context={{ entityType: "Customer", entityId: customer.id, entityLabel: customer.name, country: customer.country, reseller: customer.reseller }}
        />
      </div>

      {/* §18 progress bar: Contract Not Signed → Contract Signed → Deposit Paid → Fully Paid */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {PROGRESS_STAGES.map((stage, i) => {
              const done = i <= reachedIndex;
              return (
                <div key={stage} className="grid gap-1.5">
                  <div className={`h-1.5 rounded-full ${done ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`} />
                  <p className={`text-[11px] ${done ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{stage}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Customer summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Detail label="Contract status" value={customer.contractStatus} />
            <Detail label="Invoice status" value={customer.invoiceStatus} />
            <Detail label="Invoiced total" value={money(customer.invoiceTotal)} />
            <Detail label="Paid total" value={money(customer.paidTotal)} />
            <Detail label="Balance due" value={customer.balance > 0 ? money(customer.balance) : "Settled"} />
            <Detail label="Progress" value={customer.progress} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Reseller ownership &amp; contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Detail label="Reseller" value={customer.reseller} />
            <Detail label="Country" value={customer.country} />
            <Detail label="Phone" value={phone ?? "—"} />
            <Detail label="Assigned user" value="—" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {invoices.length === 0 ? <p className="text-sm text-[var(--muted)]">No invoices recorded.</p> : invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="flex items-center gap-1.5 font-semibold"><FileText className="size-3.5 text-[var(--muted)]" />{i.invoiceNumber}</span><span className="text-[var(--muted)]">{i.currency} {i.total.toLocaleString()} · {i.paymentStatus}</span></div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Receipts</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {receipts.length === 0 ? <p className="text-sm text-[var(--muted)]">No receipts recorded.</p> : receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="flex items-center gap-1.5 font-semibold"><Receipt className="size-3.5 text-[var(--muted)]" />{r.receiptNumber}</span><span className="text-[var(--muted)]">{r.currency} {r.amount.toLocaleString()} · {r.paymentMethod}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-[var(--muted)]">Regional monitoring view — read-only. Contracts, invoicing, and receipts are owned by the reseller. Escalate to flag a stuck customer without taking ownership.</p>
    </div>
  );
}
