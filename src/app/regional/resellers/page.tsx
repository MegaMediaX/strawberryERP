import { RegionalResellersView } from "@/components/regional/RegionalResellersView";
import { regionalResellers } from "@/lib/regional/reseller-list";
import { regionalScopedData } from "@/lib/regional/scoped-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalResellersPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const d = await regionalScopedData(session, country);
  const rows = regionalResellers(d.leads, d.invoices, d.receipts, d.commissions, d.customers, new Date());

  return <RegionalResellersView rows={rows} scopeLabel={d.scopeLabel} />;
}
