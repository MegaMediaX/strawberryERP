import { AdminAuditLogsView } from "@/components/admin/AdminAuditLogsView";
import { toAuditRows } from "@/lib/admin/audit-log";
import { getDevStore, getPlatformTimeZone } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminAuditLogsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Audit Logs</h1><p className="text-sm text-[var(--muted)]">Every sensitive action — searchable, filterable, exportable, read-only</p></div>
      <AdminAuditLogsView rows={toAuditRows(getDevStore().activityTimeline)} timeZone={getPlatformTimeZone()} />
    </div>
  );
}
