import { AdminInvoicesView } from "@/components/admin/AdminInvoicesView";
import { adminBillingData } from "@/lib/admin/billing-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminInvoicesPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const d = await adminBillingData(session);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Invoices</h1><p className="text-sm text-[var(--muted)]">Every invoice across all countries and resellers</p></div>
      <AdminInvoicesView rows={d.invoices} />
    </div>
  );
}
