import { ResellerDashboardView } from "@/components/reseller/ResellerDashboardView";
import { resellerDashboardMetrics, type CommissionLike, type InvoiceLike } from "@/lib/reseller/dashboard-metrics";
import { commissionEntries, invoices as seedInvoices } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export default async function ResellerDashboardPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const [leadsResult, invoicesResult, commissionsResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", seedInvoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("commissions", commissionEntries as unknown as Record<string, unknown>[], session),
  ]);

  const invoices: InvoiceLike[] = invoicesResult.data.map((i) => ({
    paymentStatus: String(i.paymentStatus ?? i.payment_status ?? ""),
    total: Number(i.total ?? 0),
  }));
  const commissions: CommissionLike[] = commissionsResult.data.map((c) => ({
    status: String(c.status ?? ""),
    commissionAmount: Number(c.commissionAmount ?? c.commission_amount ?? 0),
  }));

  const metrics = resellerDashboardMetrics(leadsResult.data, invoices, commissions, new Date());

  return (
    <ResellerDashboardView
      resellerName={session.effectiveUser.reseller ?? "Reseller"}
      firstName={session.effectiveUser.name.split(" ")[0]}
      metrics={metrics}
    />
  );
}
