import { ResellerTeamView } from "@/components/reseller/ResellerTeamView";
import { portalUsers } from "@/lib/portal-security";
import { teamPerformance } from "@/lib/reseller/team-performance";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function ResellerTeamPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  // Reseller-scoped: sales team = active sales users in the acting admin's reseller.
  const team = portalUsers.filter(
    (u) => u.reseller === actingUser.reseller && u.role === "Sales Team User",
  );
  const leadsResult = await getUiLeads(session);
  const members = teamPerformance(team, leadsResult.data, new Date());

  return <ResellerTeamView members={members} resellerName={actingUser.reseller ?? "Reseller"} />;
}
