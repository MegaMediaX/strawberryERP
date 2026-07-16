import { ResellerCommissionsView, type CommissionRow } from "@/components/reseller/ResellerCommissionsView";
import { getDevStore, getPlatformTimeZone } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiCommissionEntries } from "@/lib/ui-data";

export default async function ResellerCommissionsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const store = getDevStore();
  const commissionsResult = await getUiCommissionEntries(session);

  // Resolve customer + currency from the linked invoice (entries don't carry them).
  const invoiceById = new Map(store.invoices.map((i) => [i.id, i]));

  const rows: CommissionRow[] = commissionsResult.data.map((c) => {
    const inv = invoiceById.get(String(c.invoice));
    return {
      id: String(c.id),
      date: String(c.calculatedAt ?? ""),
      invoice: String(c.invoice ?? ""),
      customer: inv?.customer ?? "—",
      country: String(c.country ?? ""),
      trigger: String(c.commissionRule ?? "—"),
      baseAmount: Number(c.baseAmount ?? 0),
      commissionPercentage: Number(c.commissionPercentage ?? 0),
      commissionAmount: Number(c.commissionAmount ?? 0),
      currency: inv?.currency ?? "USD",
      status: (String(c.status ?? "Pending") as CommissionRow["status"]),
    };
  });

  return (
    <ResellerCommissionsView
      rows={rows}
      resellerName={session.effectiveUser.reseller ?? "Reseller"}
      now={new Date().toISOString()}
      timeZone={getPlatformTimeZone()}
    />
  );
}
