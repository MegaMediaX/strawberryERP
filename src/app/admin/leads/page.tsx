import { AdminLeadsView } from "@/components/admin/AdminLeadsView";
import { getUsers } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function AdminLeadsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const leadsResult = await getUiLeads(session);
  const assignees = getUsers().filter((u) => u.active && (u.role === "Sales Team User" || u.role === "Reseller Admin")).map((u) => u.name);
  return <AdminLeadsView leads={leadsResult.data} assignees={assignees} />;
}
