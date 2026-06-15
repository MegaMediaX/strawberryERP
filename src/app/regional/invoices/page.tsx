import { RegionalInvoicesView } from "@/components/regional/RegionalInvoicesView";
import { regionalBillingData } from "@/lib/regional/billing-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalInvoicesPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const d = await regionalBillingData(session, country);

  return <RegionalInvoicesView rows={d.invoices} scopeLabel={d.scopeLabel} customerIdByName={d.customerIdByName} />;
}
