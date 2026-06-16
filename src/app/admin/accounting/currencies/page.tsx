import { AdminAccountingNav } from "@/components/admin/AdminAccountingNav";
import { AdminCurrenciesView } from "@/components/admin/AdminCurrenciesView";
import { currencyUsageCount } from "@/lib/admin/accounting";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCurrenciesPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const store = getDevStore();
  const currencies = store.currencySettings.map((c) => ({ ...c, assignedCountries: [...c.assignedCountries], assignedResellers: [...c.assignedResellers] }));
  const usage: Record<string, number> = {};
  for (const c of currencies) usage[c.currencyCode] = currencyUsageCount(c.currencyCode, store.invoices);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Currencies</h1><p className="text-sm text-[var(--muted)]">Add or disable · warns when a currency is in use</p></div>
      <AdminAccountingNav />
      <AdminCurrenciesView currencies={currencies} usage={usage} />
    </div>
  );
}
