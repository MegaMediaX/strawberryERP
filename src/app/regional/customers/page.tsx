import { RegionalCustomersView } from "@/components/regional/RegionalCustomersView";
import { regionalCustomerData } from "@/lib/regional/customer-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalCustomersPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const d = await regionalCustomerData(session, country);

  return <RegionalCustomersView rows={d.rows} scopeLabel={d.scopeLabel} phoneByCompany={d.phoneByCompany} />;
}
