import { ResellerCsvImport } from "@/components/reseller/ResellerCsvImport";
import { getUsers } from "@/lib/dev-store";
import { dedupKey } from "@/lib/reseller/csv-import";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function ResellerImportPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  const countries = actingUser.countries as readonly string[];
  const assignees = getUsers()
    .filter((u) => u.active && u.reseller === actingUser.reseller)
    .map((u) => u.name);

  // Existing reseller leads → dedup keys, so the preview can flag duplicates.
  const leadsResult = await getUiLeads(session);
  const existingKeys = leadsResult.data.map((l) => dedupKey(l.company, l.phone));

  return <ResellerCsvImport countries={countries} assignees={assignees} existingKeys={existingKeys} />;
}
