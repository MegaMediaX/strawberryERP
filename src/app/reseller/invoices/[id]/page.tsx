import Link from "next/link";

import { ReceiptBuilder } from "@/components/platform/Phase2Forms";
import { ArrowLeftLink } from "@/components/reseller/BackLink";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDevStore } from "@/lib/dev-store";
import { paymentMethods as seedMethods } from "@/lib/phase2-data";
import { invoicePaymentState, type InvoiceLike, type ReceiptLike } from "@/lib/reseller/invoice-payment-state";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiRows } from "@/lib/ui-data";

const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;
const statusTone = (s: string) => (s === "Paid" ? "green" : s === "Partially Paid" ? "amber" : "rose");

export default async function ResellerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUiSession();
  if (!session) return null;

  const reseller = session.effectiveUser.reseller ?? "";
  const invoicesResult = await getUiRows<Record<string, unknown>>(
    "invoices", getDevStore().invoices as unknown as Record<string, unknown>[], session,
  );
  const invoice = getDevStore().invoices.find((i) => i.id === id);
  const inScope = invoicesResult.data.some((i) => String(i.id) === id);

  if (!invoice || !inScope) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This invoice is not under your reseller, or it doesn&apos;t exist.</p>
          <Link href="/reseller/invoices" className="text-sm font-semibold text-[var(--brand)]">← Back to invoices</Link>
        </CardContent>
      </Card>
    );
  }

  const receipts = getDevStore().receipts.filter((r) => r.invoice === invoice.id && r.reseller === reseller);
  const state = invoicePaymentState(invoice as unknown as InvoiceLike, getDevStore().receipts as unknown as ReceiptLike[]);

  const methods = seedMethods
    .filter((m) => m.isActive && m.resellers.includes(reseller) && (m.countries as readonly string[]).includes(invoice.country))
    .map((m) => m.methodName);

  return (
    <div className="grid gap-4">
      <ArrowLeftLink href="/reseller/invoices" label={invoice.invoiceNumber} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Invoice</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-[var(--muted)]">Customer</p><p className="font-semibold">{invoice.customer}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Country</p><p className="font-semibold">{invoice.country}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Amount</p><p className="font-semibold">{money(invoice.total, invoice.currency)}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Due date</p><p className="font-semibold">{invoice.dueDate ?? "—"}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Status</p><p><Badge tone={statusTone(state.plainStatus)}>{state.plainStatus}</Badge></p></div>
            <div><p className="text-xs text-[var(--muted)]">Payment method</p><p className="font-semibold">{state.paymentMethod}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Balance</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-[var(--muted)]">Invoiced</p><p className="text-lg font-bold">{money(invoice.total, invoice.currency)}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Paid</p><p className="text-lg font-bold text-emerald-600">{money(state.amountPaid, invoice.currency)}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Remaining</p><p className={`text-lg font-bold ${state.remaining > 0 ? "text-amber-600" : ""}`}>{money(state.remaining, invoice.currency)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Receipts</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {receipts.length === 0 ? <p className="text-sm text-[var(--muted)]">No receipts recorded yet.</p> : receipts.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.receiptNumber}</p>
                <p className="text-xs text-[var(--muted)]">{r.paymentMethod}{r.paymentReference ? ` · ${r.paymentReference}` : ""}{r.issuedAt ? ` · ${new Date(r.issuedAt).toLocaleDateString()}` : ""}</p>
              </div>
              <span className="text-sm font-semibold">{money(r.amount, r.currency)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {state.remaining > 0 ? (
        <div className="grid gap-2">
          <h2 className="text-lg font-bold tracking-tight">Record a payment</h2>
          <ReceiptBuilder invoices={[invoice]} paymentMethods={methods.length ? methods : ["Cash"]} defaultAmount={state.remaining} />
        </div>
      ) : (
        <Card><CardContent className="pt-5"><p className="text-sm font-medium text-emerald-600">This invoice is fully paid.</p></CardContent></Card>
      )}
    </div>
  );
}
