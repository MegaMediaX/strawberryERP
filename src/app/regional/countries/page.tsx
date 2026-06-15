import { RegionalCountriesView } from "@/components/regional/RegionalCountriesView";
import { regionalCommissionData } from "@/lib/regional/commission-data";
import { countryPerformance } from "@/lib/regional/regional-reports";
import { regionalScopedData } from "@/lib/regional/scoped-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalCountriesPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const [d, commissionData] = await Promise.all([
    regionalScopedData(session, country),
    regionalCommissionData(session, country),
  ]);

  const commissions = commissionData.rows.map((c) => ({ reseller: c.reseller, status: c.status, commissionAmount: c.commissionAmount, country: c.country }));
  const rows = countryPerformance(d.leads, d.invoices, d.receipts, commissions, new Date());

  return <RegionalCountriesView rows={rows} scopeLabel={d.scopeLabel} />;
}
