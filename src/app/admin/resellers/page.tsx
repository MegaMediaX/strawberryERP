import { AdminResellersView } from "@/components/admin/AdminResellersView";
import { adminResellersData } from "@/lib/admin/resellers-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminResellersPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const rows = await adminResellersData(session);
  return <AdminResellersView rows={rows} />;
}
