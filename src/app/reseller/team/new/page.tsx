import { ResellerNewTeamMember } from "@/components/reseller/ResellerNewTeamMember";
import { creatableRoles } from "@/lib/business/team-member-create";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function ResellerNewTeamMemberPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  return (
    <ResellerNewTeamMember
      actingUser={actingUser}
      roles={creatableRoles(actingUser.role)}
      countries={actingUser.countries as string[]}
    />
  );
}
