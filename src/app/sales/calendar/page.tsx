import { SalesCalendarAgenda } from "@/components/sales/SalesCalendarAgenda";
import { buildAgenda } from "@/lib/sales/build-agenda";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function SalesCalendarPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const result = await getUiLeads(session);
  const sections = buildAgenda(result.data, new Date());
  return <SalesCalendarAgenda sections={sections} />;
}
