import { PartnerPlatformApp } from "@/components/dashboard/PartnerPlatformApp";
import { ProtectedRoute } from "@/components/security/ProtectedRoute";
import { authorizeUiRoute } from "@/lib/security/route-access";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function Home() {
  const session = await getPortalUiSession();
  const decision = authorizeUiRoute("/", session);
  if (!decision.allowed) {
    return <ProtectedRoute decision={decision} />;
  }
  if (!session) {
    return null;
  }
  const leadResult = await getUiLeads(session);
  return <PartnerPlatformApp initialLeads={leadResult.data} loadError={leadResult.error} session={session} source={leadResult.source} />;
}
