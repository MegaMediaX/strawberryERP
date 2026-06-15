import { ResellerLeadsView } from "@/components/reseller/ResellerLeadsView";
import { getUsers } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function ResellerLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ assignedUser?: string }>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  const leadsResult = await getUiLeads(session);
  const { assignedUser } = await searchParams;

  // Reseller team = active users in the acting admin's reseller (assignee pool).
  const teamUsers = getUsers().filter((u) => u.active && u.reseller === actingUser.reseller);

  return (
    <ResellerLeadsView
      leads={leadsResult.data}
      teamUsers={teamUsers}
      actingUser={actingUser}
      resellerName={actingUser.reseller ?? "Reseller"}
      initialAssignedUser={assignedUser}
    />
  );
}
