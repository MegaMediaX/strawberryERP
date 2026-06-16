import { AdminCommissionsView } from "@/components/admin/AdminCommissionsView";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCommissionsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <AdminCommissionsView entries={[...getDevStore().commissionEntries]} />
    </div>
  );
}
