import { ResellerLeadsView } from "@/components/reseller/ResellerLeadsView";
import { portalUsers } from "@/lib/portal-security";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function ResellerLeadsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  const leadsResult = await getUiLeads(session);

  // Reseller team = active users in the acting admin's reseller (assignee pool).
  const teamUsers = portalUsers.filter((u) => u.active && u.reseller === actingUser.reseller);

  return (
    <ResellerLeadsView
      leads={leadsResult.data}
      teamUsers={teamUsers}
      actingUser={actingUser}
      resellerName={actingUser.reseller ?? "Reseller"}
    />
  );
}
