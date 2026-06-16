import { AdminGlobalSearch } from "@/components/admin/AdminGlobalSearch";
import { adminSearchData } from "@/lib/admin/global-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminSearchPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const data = await adminSearchData(session);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Search</h1><p className="text-sm text-[var(--muted)]">Find any record across every country, reseller, and module</p></div>
      <AdminGlobalSearch data={data} />
    </div>
  );
}
