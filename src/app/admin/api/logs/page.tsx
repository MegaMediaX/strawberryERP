import { AdminApiNav } from "@/components/admin/AdminApiNav";
import { AdminApiLogsView } from "@/components/admin/AdminApiLogsView";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminApiLogsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">API Logs</h1><p className="text-sm text-[var(--muted)]">Every request, with status + duration</p></div>
      <AdminApiNav />
      <AdminApiLogsView logs={[...getDevStore().apiLogs]} />
    </div>
  );
}
