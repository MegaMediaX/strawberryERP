import Link from "next/link";

import { RegionalCustomerDetail } from "@/components/regional/RegionalCustomerDetail";
import { Card, CardContent } from "@/components/ui/card";
import type { RelatedInvoice, RelatedReceipt } from "@/lib/business/related-records";
import { getDevStore } from "@/lib/dev-store";
import { regionalCustomerData } from "@/lib/regional/customer-data";

export default async function RegionalCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { getPortalUiSession } = await import("@/lib/security/ui-session");
  const session = await getPortalUiSession();
  if (!session) return null;

  // regionalCustomerData country-scopes a Regional Director to their assigned countries.
  const d = await regionalCustomerData(session);
  const customer = d.rows.find((c) => c.id === id);

  if (!customer) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This customer is outside your regional access scope, or it doesn&apos;t exist.</p>
          <Link href="/regional/customers" className="text-sm font-semibold text-[var(--brand)]">← Back to customers</Link>
        </CardContent>
      </Card>
    );
  }

  const store = getDevStore();
  const sameScope = (r: { customer: string; reseller: string }) => r.customer === customer.name && r.reseller === customer.reseller;
  const invoices = (store.invoices as unknown as RelatedInvoice[]).filter(sameScope);
  const receipts = (store.receipts as unknown as RelatedReceipt[]).filter(sameScope);

  return (
    <RegionalCustomerDetail
      customer={customer}
      invoices={invoices}
      receipts={receipts}
      phone={d.phoneByCompany[customer.name]}
    />
  );
}
