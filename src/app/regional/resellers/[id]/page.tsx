import Link from "next/link";

import { RegionalResellerProfile, type ProfileLists } from "@/components/regional/RegionalResellerProfile";
import { Card, CardContent } from "@/components/ui/card";
import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import { regionalResellers, resellerRegionalProfile } from "@/lib/regional/reseller-list";
import { regionalScopedData } from "@/lib/regional/scoped-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalResellerProfilePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { id } = await params;
  const reseller = decodeURIComponent(id);
  const { country } = await searchParams;
  const d = await regionalScopedData(session, country);

  // §28 — a reseller not operating in the director's (scoped) countries is out of scope.
  const inScope = regionalResellers(d.leads, d.invoices, d.receipts, d.commissions, d.customers, new Date()).some((r) => r.reseller === reseller);
  if (!inScope) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This reseller is not active in your assigned countries{country ? ` for ${country}` : ""}.</p>
          <Link href="/regional/resellers" className="text-sm font-semibold text-[var(--brand)]">← Back to resellers</Link>
        </CardContent>
      </Card>
    );
  }

  const profile = resellerRegionalProfile(reseller, d.leads, d.invoices, d.receipts, d.commissions, d.customers, new Date());
  const inEffScope = (c: unknown) => d.effective.includes(String(c));
  const store = getDevStore();
  const lists: ProfileLists = {
    invoices: store.invoices.filter((i) => i.reseller === reseller && inEffScope(i.country)).map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, country: i.country, total: i.total, currency: i.currency, paymentStatus: i.paymentStatus })),
    receipts: store.receipts.filter((r) => r.reseller === reseller && inEffScope(r.country)).map((r) => ({ id: r.id, receiptNumber: r.receiptNumber, amount: r.amount, currency: r.currency, paymentMethod: r.paymentMethod })),
    commissions: store.commissionEntries.filter((c) => c.reseller === reseller && inEffScope(c.country)).map((c) => ({ id: c.id, status: c.status, commissionAmount: c.commissionAmount })),
    customers: seedCustomers.filter((c) => c.reseller === reseller && inEffScope(c.country)).map((c) => ({ id: c.id, name: c.name, country: c.country })),
  };

  return <RegionalResellerProfile reseller={reseller} profile={profile} lists={lists} scopeLabel={d.scopeLabel} />;
}
