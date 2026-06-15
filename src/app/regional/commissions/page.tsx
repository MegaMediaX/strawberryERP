import { RegionalCommissionsView } from "@/components/regional/RegionalCommissionsView";
import { canViewCommissionPercent, type CommissionStatus } from "@/lib/regional/commission-list";
import { regionalCommissionData } from "@/lib/regional/commission-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalCommissionsPage({ searchParams }: {
  searchParams: Promise<{ country?: string; reseller?: string; status?: string }>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const sp = await searchParams;
  const d = await regionalCommissionData(session, sp.country);

  return (
    <RegionalCommissionsView
      rows={d.rows}
      scopeLabel={d.scopeLabel}
      canViewPercent={canViewCommissionPercent(session.effectiveUser.role)}
      initialFilters={{
        reseller: sp.reseller ? decodeURIComponent(sp.reseller) : undefined,
        status: sp.status ? (decodeURIComponent(sp.status) as CommissionStatus) : undefined,
      }}
    />
  );
}
