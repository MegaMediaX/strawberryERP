import { SalesFollowUpsView } from "@/components/sales/SalesFollowUpsView";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function SalesFollowUpsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const result = await getUiLeads(session);
  return <SalesFollowUpsView leads={result.data} />;
}
