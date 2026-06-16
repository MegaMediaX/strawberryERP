import { AdminAccountingNav } from "@/components/admin/AdminAccountingNav";
import { AdminPnlView } from "@/components/admin/AdminPnlView";
import { expenseSummaryByCategory, pnlSummary } from "@/lib/admin/pnl";
import { getDevStore, getExpenses } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminPnlPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const store = getDevStore();
  const expenses = getExpenses();
  const summary = pnlSummary(store.receipts, expenses, store.commissionEntries);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Profit &amp; Loss</h1><p className="text-sm text-[var(--muted)]">Global platform P&amp;L · Super Admin only</p></div>
      <AdminAccountingNav />
      <AdminPnlView summary={summary} byCategory={expenseSummaryByCategory(expenses)} />
    </div>
  );
}
