import { RegionalReportsView } from "@/components/regional/RegionalReportsView";
import { regionalCommissionData } from "@/lib/regional/commission-data";
import { countryPerformance, leadConversionFunnel, revenueReceipts } from "@/lib/regional/regional-reports";
import { regionalResellers } from "@/lib/regional/reseller-list";
import { regionalScopedData } from "@/lib/regional/scoped-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalReportsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const [d, commissionData] = await Promise.all([
    regionalScopedData(session, country),
    regionalCommissionData(session, country),
  ]);
  const now = new Date();

  // Commission rows carry country (RCommission alone does not) — used for both reports.
  const commissions = commissionData.rows.map((c) => ({ reseller: c.reseller, status: c.status, commissionAmount: c.commissionAmount, country: c.country }));

  return (
    <RegionalReportsView
      scopeLabel={d.scopeLabel}
      country={countryPerformance(d.leads, d.invoices, d.receipts, commissions, now)}
      resellers={regionalResellers(d.leads, d.invoices, d.receipts, commissions, d.customers, now)}
      conversion={leadConversionFunnel(d.leads)}
      revenue={revenueReceipts(d.invoices, d.receipts)}
    />
  );
}
