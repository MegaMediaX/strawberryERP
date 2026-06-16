import { AdminReceiptsView } from "@/components/admin/AdminReceiptsView";
import { adminBillingData } from "@/lib/admin/billing-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminReceiptsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const d = await adminBillingData(session);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Receipts</h1><p className="text-sm text-[var(--muted)]">Every payment receipt across all countries and resellers</p></div>
      <AdminReceiptsView rows={d.receipts} />
    </div>
  );
}
