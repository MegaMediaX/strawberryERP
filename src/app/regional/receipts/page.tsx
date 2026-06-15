import { RegionalReceiptsView } from "@/components/regional/RegionalReceiptsView";
import { regionalBillingData } from "@/lib/regional/billing-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalReceiptsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const d = await regionalBillingData(session, country);

  return <RegionalReceiptsView rows={d.receipts} scopeLabel={d.scopeLabel} />;
}
