import Link from "next/link";
import { FileText, MessageCircle, Plus, Receipt as ReceiptIcon, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInstantDayLong } from "@/lib/datetime-ui";
import { PROGRESS_STAGES, type CustomerRollup } from "@/lib/reseller/customer-rollup";
import { formatAmount, formatMoney } from "@/lib/money-ui";

export interface CustomerContract {
  contractStatus: "Not Signed" | "Signed";
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}
export interface CustomerInvoice { id: string; invoiceNumber: string; currency: string; total: number; paymentStatus: string }
export interface CustomerReceipt { id: string; receiptNumber: string; currency: string; amount: number; paymentMethod: string }

const money = (n: number) => `$${formatAmount(n)}`;
const wa = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}`;

const action = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";
const actionDisabled = "inline-flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted)] opacity-60";

export function ResellerCustomerDetail({
  customer, contract, invoices, receipts, phone, timeZone,
}: {
  customer: CustomerRollup;
  contract?: CustomerContract;
  invoices: CustomerInvoice[];
  receipts: CustomerReceipt[];
  phone?: string;
  timeZone: string;
}) {
  const currentStage = PROGRESS_STAGES.indexOf(customer.progress);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-[var(--muted)]">{customer.country} · {customer.reseller}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {phone ? <a href={wa(phone)} target="_blank" rel="noopener noreferrer" className={action}><MessageCircle className="size-4" /> WhatsApp</a> : null}
          <Link href={`/reseller/customers/${customer.id}/contracts`} className={action}><Upload className="size-4" /> Upload contract</Link>
          <span title="Invoice creation ships in the invoices slice." className={actionDisabled}><Plus className="size-4" /> Create invoice</span>
          <span title="Receipt creation ships in the invoices slice." className={actionDisabled}><Plus className="size-4" /> Create receipt</span>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-4 gap-1">
            {PROGRESS_STAGES.map((stage, i) => (
              <div key={stage} className="grid gap-1.5">
                <div className={`h-1.5 rounded-full ${i <= currentStage ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`} />
                <span className={`text-[10px] sm:text-xs ${i <= currentStage ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{stage}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-[var(--muted)]">Invoice status</p><p className="font-semibold">{customer.invoiceStatus}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Balance due</p><p className="font-semibold">{customer.balance > 0 ? money(customer.balance) : "—"}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Invoiced</p><p className="font-semibold">{money(customer.invoiceTotal)}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Paid</p><p className="font-semibold">{money(customer.paidTotal)}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Contact</p><p className="text-[var(--muted)]">—</p></div>
            <div><p className="text-xs text-[var(--muted)]">Assigned user</p><p className="text-[var(--muted)]">—</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Contract</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center gap-2"><Badge tone={customer.contractStatus === "Signed" ? "green" : "neutral"}>{customer.contractStatus}</Badge></div>
            {contract && contract.fileUrl ? (
              <p className="text-xs text-[var(--muted)]">Uploaded by {contract.uploadedBy} · {formatInstantDayLong(contract.uploadedAt, timeZone)} ·<a href={contract.fileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand)]">View file</a></p>
            ) : <p className="text-xs text-[var(--muted)]">No contract file uploaded yet.</p>}
            <Link href={`/reseller/customers/${customer.id}/contracts`} className="text-sm font-semibold text-[var(--brand)]">Manage contracts →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {invoices.length === 0 ? <p className="text-sm text-[var(--muted)]">No invoices yet.</p> : invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><FileText className="size-3.5 text-[var(--muted)]" />{i.invoiceNumber}</p>
                <span className="text-sm text-[var(--muted)]">{formatMoney(i.total, i.currency)} · {i.paymentStatus}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Receipts</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {receipts.length === 0 ? <p className="text-sm text-[var(--muted)]">No receipts yet.</p> : receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><ReceiptIcon className="size-3.5 text-[var(--muted)]" />{r.receiptNumber}</p>
                <span className="text-sm text-[var(--muted)]">{formatMoney(r.amount, r.currency)} · {r.paymentMethod}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-[var(--muted)]">Notes, timeline &amp; attachments aren&apos;t stored on the customer record yet. Create invoice/receipt ship with the invoices slice.</p>
    </div>
  );
}
