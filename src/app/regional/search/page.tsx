import { RegionalGlobalSearch } from "@/components/regional/RegionalGlobalSearch";
import { regionalSearchData } from "@/lib/regional/regional-search-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalSearchPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const { data, scopeLabel } = await regionalSearchData(session, country);

  return <RegionalGlobalSearch data={data} scopeLabel={scopeLabel} />;
}
