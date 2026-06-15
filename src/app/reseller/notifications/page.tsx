import { ResellerNotificationsView } from "@/components/reseller/ResellerNotificationsView";
import { resellerNotificationData } from "@/lib/reseller/notification-data";
import { resellerNotifications } from "@/lib/reseller/reseller-notifications";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function ResellerNotificationsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const data = await resellerNotificationData(session);
  const notifications = resellerNotifications(data, new Date());

  return <ResellerNotificationsView notifications={notifications} />;
}
