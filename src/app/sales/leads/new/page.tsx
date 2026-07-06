import { SalesNewLead } from "@/components/sales/SalesNewLead";
import { assignableUsersFor } from "@/lib/security/assignable-users";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function SalesNewLeadPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  // §9: assignment is a dropdown scoped to who the user has authority over. A
  // Sales Team User may only assign leads to themselves, so the dropdown holds
  // exactly their own name (locked, no free-text).
  const assignees = assignableUsersFor(actingUser).map((u) => ({ name: u.name }));

  return <SalesNewLead assignedUser={actingUser.name} assignees={assignees} />;
}
