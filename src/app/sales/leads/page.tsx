import { SalesLeadsView } from "@/components/sales/SalesLeadsView";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function SalesLeadsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const result = await getUiLeads(session);
  return <SalesLeadsView leads={result.data} />;
}
