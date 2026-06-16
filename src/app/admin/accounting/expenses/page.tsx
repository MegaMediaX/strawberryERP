import { AdminAccountingNav } from "@/components/admin/AdminAccountingNav";
import { AdminExpensesView } from "@/components/admin/AdminExpensesView";
import { getDevStore, getExpenses } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminExpensesPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const currencies = getDevStore().currencySettings.filter((c) => c.isActive).map((c) => c.currencyCode);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Expenses</h1><p className="text-sm text-[var(--muted)]">Platform expenses · feeds the P&amp;L</p></div>
      <AdminAccountingNav />
      <AdminExpensesView expenses={[...getExpenses()]} currencies={currencies} />
    </div>
  );
}
