import { AdminAccountingNav } from "@/components/admin/AdminAccountingNav";
import { AdminPaymentMethodsView } from "@/components/admin/AdminPaymentMethodsView";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminPaymentMethodsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const methods = getDevStore().paymentMethods.map((m) => ({ ...m, countries: [...m.countries], resellers: [...m.resellers] }));
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Payment Methods</h1><p className="text-sm text-[var(--muted)]">Database-driven · disable instead of delete</p></div>
      <AdminAccountingNav />
      <AdminPaymentMethodsView methods={methods} />
    </div>
  );
}
