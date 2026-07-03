import { RegionalCustomersView } from "@/components/regional/RegionalCustomersView";
import { regionalCustomerData } from "@/lib/regional/customer-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; reseller?: string }>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country, reseller } = await searchParams;
  const d = await regionalCustomerData(session, country);

  const initialFilters = { reseller: reseller ? decodeURIComponent(reseller) : undefined };

  return <RegionalCustomersView rows={d.rows} scopeLabel={d.scopeLabel} phoneByCompany={d.phoneByCompany} initialFilters={initialFilters} />;
}
