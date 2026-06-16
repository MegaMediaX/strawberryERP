import { AdminCustomersView } from "@/components/admin/AdminCustomersView";
import { adminCustomersData } from "@/lib/admin/customers-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCustomersPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const data = await adminCustomersData(session);
  return <AdminCustomersView rows={data.rows} />;
}
