import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export default async function ResellerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Card>
      <CardContent className="grid gap-3 pt-5">
        <h1 className="text-lg font-bold">Invoice {id}</h1>
        <p className="text-sm text-[var(--muted)]">Invoice detail + receipts / payment (§20) ship in the next slice.</p>
        <Link href="/reseller/invoices" className="text-sm font-semibold text-[var(--brand)]">← Back to invoices</Link>
      </CardContent>
    </Card>
  );
}
