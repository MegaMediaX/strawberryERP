import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestDeleteButton } from "@/components/admin/RequestDeleteButton";
import { getDevStore } from "@/lib/dev-store";
import { invoicePaymentState } from "@/lib/reseller/invoice-payment-state";
import { getPortalUiSession } from "@/lib/security/ui-session";

const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;
  const { id } = await params;
  const store = getDevStore();
  const invoice = store.invoices.find((i) => i.id === id);

  if (!invoice) {
    return (
      <div className="grid gap-5">
        <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"><ArrowLeft className="size-4" /> Back to invoices</Link>
        <EmptyState title="Invoice not found" description={`No invoice with id ${id}.`} />
      </div>
    );
  }

  const receipts = store.receipts.filter((r) => r.invoice === invoice.id);
  const state = invoicePaymentState(
    { id: invoice.id, invoiceNumber: invoice.invoiceNumber, customer: invoice.customer, country: invoice.country, reseller: invoice.reseller, currency: invoice.currency, total: invoice.total, dueDate: invoice.dueDate },
    receipts.map((r) => ({ invoice: r.invoice, reseller: r.reseller, amount: r.amount, paymentMethod: r.paymentMethod })),
  );
  const tone = state.plainStatus === "Paid" ? "green" : state.plainStatus === "Partially Paid" ? "amber" : "neutral";

  return (
    <div className="grid gap-5">
      <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"><ArrowLeft className="size-4" /> Back to invoices</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-xl font-bold tracking-tight">{invoice.invoiceNumber}</h1><Badge tone={tone}>{state.plainStatus}</Badge></div>
          <p className="text-sm text-[var(--muted)]">{invoice.customer} · {invoice.country} · {invoice.reseller}</p>
        </div>
        <RequestDeleteButton entityType="Invoice" entityId={invoice.id} label={`Invoice ${invoice.invoiceNumber}`} country={invoice.country} reseller={invoice.reseller} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Line items</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto pt-1">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">{["Description", "Qty", "Unit", "Amount"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {invoice.lineItems.map((li, idx) => (
                  <tr key={idx} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4">{li.description}</td>
                    <td className="py-2.5 pr-4 text-[var(--muted)]">{li.quantity}</td>
                    <td className="py-2.5 pr-4 text-[var(--muted)]">{money(li.unitPrice, invoice.currency)}</td>
                    <td className="py-2.5 pr-4 font-medium">{money(li.quantity * li.unitPrice, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 grid gap-1 text-sm">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span>{money(invoice.subtotal, invoice.currency)}</span></div>
              {invoice.discount > 0 && <div className="flex justify-between"><span className="text-[var(--muted)]">Discount</span><span>−{money(invoice.discount, invoice.currency)}</span></div>}
              <div className="flex justify-between font-bold"><span>Total</span><span>{money(invoice.total, invoice.currency)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Paid</span><span className="text-emerald-600 dark:text-emerald-400">{money(state.amountPaid, invoice.currency)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Remaining</span><span>{money(state.remaining, invoice.currency)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Receipts ({receipts.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 pt-1">
            {receipts.length === 0 ? <p className="text-sm text-[var(--muted)]">No receipts yet.</p> : receipts.map((r) => (
              <Link key={r.id} href={`/admin/receipts/${r.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--background)]">
                <span className="font-medium">{r.receiptNumber}</span><span className="text-[var(--muted)]">{money(r.amount, r.currency)} · {r.paymentMethod}</span>
              </Link>
            ))}
            <p className="mt-1 text-xs text-[var(--muted)]">Due {invoice.dueDate?.slice(0, 10) ?? "—"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
