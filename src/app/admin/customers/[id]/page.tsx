import Link from "next/link";

import { AdminCustomerDetail } from "@/components/admin/AdminCustomerDetail";
import { Card, CardContent } from "@/components/ui/card";
import { adminCustomerById } from "@/lib/admin/customers-data";
import { getCustomerOverrides, getDevStore } from "@/lib/dev-store";
import type { RelatedInvoice, RelatedReceipt } from "@/lib/business/related-records";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;
  const { id } = await params;
  const customer = adminCustomerById(id);
  if (!customer) {
    return (
      <Card><CardContent className="grid gap-3 pt-5">
        <p className="text-sm text-[var(--muted)]">This customer doesn&apos;t exist or was deleted.</p>
        <Link href="/admin/customers" className="text-sm font-semibold text-[var(--brand)]">← Back to customers</Link>
      </CardContent></Card>
    );
  }
  const store = getDevStore();
  const sameScope = (r: { customer: string; reseller: string }) => r.customer === customer.name && r.reseller === customer.reseller;
  const invoices = (store.invoices as unknown as RelatedInvoice[]).filter(sameScope);
  const receipts = (store.receipts as unknown as RelatedReceipt[]).filter(sameScope);
  const notes = getCustomerOverrides()[customer.id]?.notes ?? [];
  return <AdminCustomerDetail customer={customer} invoices={invoices} receipts={receipts} notes={notes} />;
}
