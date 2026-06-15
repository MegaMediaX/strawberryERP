import { RegionalProfileView } from "@/components/regional/RegionalProfileView";
import { formatRole, getTimezoneLabel } from "@/lib/sales/profile-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalProfilePage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const u = session.effectiveUser;
  return (
    <RegionalProfileView
      name={u.name}
      email={u.email}
      role={formatRole(u.role)}
      countries={[...u.countries]}
      timezone={getTimezoneLabel(u.countries)}
    />
  );
}
