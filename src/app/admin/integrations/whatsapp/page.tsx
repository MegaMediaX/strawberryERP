import { AdminIntegrationForm } from "@/components/admin/AdminIntegrationForm";
import { AdminIntegrationsNav } from "@/components/admin/AdminIntegrationsNav";
import { getDevStore, getPlatformTimeZone } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";
import type { IntegrationType } from "@/lib/phase2-data";

const TYPE: IntegrationType = "WhatsApp";

export default async function Page() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const setting = getDevStore().integrationSettings.find((s) => s.integrationType === TYPE);
  if (!setting) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">WhatsApp</h1><p className="text-sm text-[var(--muted)]">Configure + run a simulated connection test</p></div>
      <AdminIntegrationsNav />
      <AdminIntegrationForm type={TYPE} setting={setting} timeZone={getPlatformTimeZone()} />
    </div>
  );
}
