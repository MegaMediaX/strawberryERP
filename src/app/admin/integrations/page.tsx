import { AdminIntegrationsNav } from "@/components/admin/AdminIntegrationsNav";
import { AdminIntegrationsOverview } from "@/components/admin/AdminIntegrationsOverview";
import { integrationLogs } from "@/lib/admin/integrations";
import { getDevStore, getPlatformTimeZone } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminIntegrationsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const store = getDevStore();
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Integrations</h1><p className="text-sm text-[var(--muted)]">WhatsApp · Google Calendar · Google Drive · SMTP · config forms only (no live sends)</p></div>
      <AdminIntegrationsNav />
      <AdminIntegrationsOverview settings={[...store.integrationSettings]} logs={integrationLogs(store.activityTimeline)} timeZone={getPlatformTimeZone()} />
    </div>
  );
}
