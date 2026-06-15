import { ResellerTeamAgenda } from "@/components/reseller/ResellerTeamAgenda";
import { distinctValues } from "@/lib/sales/lead-filters";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

const PRIORITIES = ["Low", "Medium", "High", "VIP"];

export default async function ResellerCalendarPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  // Reseller-scoped: getUiLeads returns the whole team's leads for a Reseller Admin.
  const leadsResult = await getUiLeads(session);
  const leads = leadsResult.data;

  return (
    <ResellerTeamAgenda
      leads={leads}
      now={new Date().toISOString()}
      assignees={distinctValues(leads, "assignedTo")}
      countries={distinctValues(leads, "country")}
      priorities={PRIORITIES}
      resellerName={session.effectiveUser.reseller ?? "your reseller"}
    />
  );
}
