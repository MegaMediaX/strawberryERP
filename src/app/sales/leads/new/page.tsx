import { SalesNewLead } from "@/components/sales/SalesNewLead";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function SalesNewLeadPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return <SalesNewLead assignedUser={session.effectiveUser.name} />;
}
