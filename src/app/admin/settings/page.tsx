import { AdminSettingsView } from "@/components/admin/AdminSettingsView";
import { getPermissionMatrix, getPlatformSettings } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminSettingsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Settings</h1><p className="text-sm text-[var(--muted)]">Platform configuration — general, roles &amp; permissions, localization, security</p></div>
      <AdminSettingsView settings={structuredClone(getPlatformSettings())} matrix={structuredClone(getPermissionMatrix())} />
    </div>
  );
}
