import { ResellerNewLead } from "@/components/reseller/ResellerNewLead";
import { getUsers } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function ResellerNewLeadPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  // §9: country dropdown limited to the reseller's assigned countries; assignee
  // dropdown limited to the reseller's own active team.
  const countries = actingUser.countries as readonly string[];
  const assignees = getUsers()
    .filter((u) => u.active && u.reseller === actingUser.reseller)
    .map((u) => ({ name: u.name }));

  return <ResellerNewLead countries={countries} assignees={assignees} />;
}
