import { RegionalReportsView } from "@/components/regional/RegionalReportsView";
import { adminGlobalData } from "@/lib/admin/global-data";
import { countryPerformance, leadConversionFunnel, revenueReceipts } from "@/lib/regional/regional-reports";
import { regionalResellers } from "@/lib/regional/reseller-list";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminReportsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const d = await adminGlobalData(session);
  const now = new Date();
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Reports</h1><p className="text-sm text-[var(--muted)]">Global platform performance — visual first, export to CSV</p></div>
      <RegionalReportsView
        scopeLabel="All countries · global"
        country={countryPerformance(d.leads, d.invoices, d.receipts, d.commissions, now)}
        resellers={regionalResellers(d.leads, d.invoices, d.receipts, d.commissions, d.customers, now)}
        conversion={leadConversionFunnel(d.leads)}
        revenue={revenueReceipts(d.invoices, d.receipts)}
      />
    </div>
  );
}
