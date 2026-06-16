import { AdminUsersView, type AdminUserRow } from "@/components/admin/AdminUsersView";
import { getUsers } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminUsersPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const rows: AdminUserRow[] = getUsers().map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, countries: [...u.countries], reseller: u.reseller, active: u.active }));
  return <AdminUsersView rows={rows} />;
}
