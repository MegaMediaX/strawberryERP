import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestDeleteButton } from "@/components/admin/RequestDeleteButton";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-[var(--muted)]">{label}</p><p className="break-words text-sm font-medium">{value || "—"}</p></div>;
}

export default async function AdminReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;
  const { id } = await params;
  const receipt = getDevStore().receipts.find((r) => r.id === id);

  if (!receipt) {
    return (
      <div className="grid gap-5">
        <Link href="/admin/receipts" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"><ArrowLeft className="size-4" /> Back to receipts</Link>
        <EmptyState title="Receipt not found" description={`No receipt with id ${id}.`} />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Link href="/admin/receipts" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"><ArrowLeft className="size-4" /> Back to receipts</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{receipt.receiptNumber}</h1>
          <p className="text-sm text-[var(--muted)]">{receipt.customer} · {receipt.country} · {receipt.reseller}</p>
        </div>
        <RequestDeleteButton entityType="Receipt" entityId={receipt.id} label={`Receipt ${receipt.receiptNumber}`} country={receipt.country} reseller={receipt.reseller} />
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Payment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
          <Detail label="Amount" value={money(receipt.amount, receipt.currency)} />
          <Detail label="Method" value={receipt.paymentMethod} />
          <Detail label="Reference" value={receipt.paymentReference} />
          <div className="min-w-0"><p className="text-xs text-[var(--muted)]">Invoice</p><Link href="/admin/invoices" className="break-words text-sm font-medium text-[var(--brand)] hover:underline">{receipt.invoice}</Link></div>
          <Detail label="Issued by" value={receipt.issuedBy} />
          <Detail label="Issued at" value={receipt.issuedAt?.slice(0, 10) || "—"} />
        </CardContent>
      </Card>
    </div>
  );
}
