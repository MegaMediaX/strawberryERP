import { AdminUserForm } from "@/components/admin/AdminUserForm";
import { getCountries, getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function NewUserPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const resellers = getDevStore().resellerRecords.map((r) => r.name);
  const countries = getCountries().filter((c) => c.active).map((c) => c.name);
  return <AdminUserForm resellers={resellers} countries={countries} />;
}
