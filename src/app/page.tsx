import { redirect } from "next/navigation";

import { PartnerPlatformApp } from "@/components/dashboard/PartnerPlatformApp";
import { ProtectedRoute } from "@/components/security/ProtectedRoute";
import { authorizeUiRoute } from "@/lib/security/route-access";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function Home() {
  const session = await getPortalUiSession();
  // Sales Team Users live entirely in the /sales persona — keep them out of the admin shell.
  if (session?.effectiveUser.role === "Sales Team User") {
    redirect("/sales/dashboard");
  }
  // Reseller Admins live entirely in the /reseller persona.
  if (session?.effectiveUser.role === "Reseller Admin") {
    redirect("/reseller/dashboard");
  }
  // Regional Directors live entirely in the /regional persona.
  if (session?.effectiveUser.role === "Regional Director") {
    redirect("/regional/dashboard");
  }
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
