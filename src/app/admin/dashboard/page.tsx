import { AdminDashboardView } from "@/components/admin/AdminDashboardView";
import { adminDashboardData } from "@/lib/admin/dashboard-data";
import { getPlatformTimeZone } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminDashboardPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const data = await adminDashboardData(session);
  return <AdminDashboardView data={data} timeZone={getPlatformTimeZone()} />;
}
