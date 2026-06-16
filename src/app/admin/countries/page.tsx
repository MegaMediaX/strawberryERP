import { AdminCountriesView } from "@/components/admin/AdminCountriesView";
import { adminCountriesData } from "@/lib/admin/countries-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCountriesPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const rows = await adminCountriesData(session);
  return <AdminCountriesView rows={rows} />;
}
