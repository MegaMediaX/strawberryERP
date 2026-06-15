import { ResellerTeamView } from "@/components/reseller/ResellerTeamView";
import { getResellerTeam } from "@/lib/dev-store";
import { creatableRoles } from "@/lib/business/team-member-create";
import { teamPerformance } from "@/lib/reseller/team-performance";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function ResellerTeamPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  // Reseller-scoped sales team from the dev-store (reflects members created this session).
  const team = getResellerTeam(actingUser.reseller ?? "");
  const leadsResult = await getUiLeads(session);
  const members = teamPerformance(team, leadsResult.data, new Date());
  const canCreate = creatableRoles(actingUser.role).length > 0;

  return <ResellerTeamView members={members} resellerName={actingUser.reseller ?? "Reseller"} canCreate={canCreate} />;
}
