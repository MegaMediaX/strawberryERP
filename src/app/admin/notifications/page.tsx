import { AdminNotificationsView } from "@/components/admin/AdminNotificationsView";
import { deriveAdminNotifications } from "@/lib/admin/notifications";
import { getDevStore, getNotificationRules, getPlatformTimeZone } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminNotificationsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const store = getDevStore();
  const inbox = deriveAdminNotifications({
    deleteQueue: store.deleteQueue,
    apiLogs: store.apiLogs,
    integrationSettings: store.integrationSettings,
    commissionEntries: store.commissionEntries,
  });
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Notifications</h1><p className="text-sm text-[var(--muted)]">Rules (who gets told what) + the platform alert inbox</p></div>
      <AdminNotificationsView rules={getNotificationRules().map((r) => ({ ...r, channels: [...r.channels] }))} inbox={inbox} timeZone={getPlatformTimeZone()} />
    </div>
  );
}
