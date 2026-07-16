import { AdminApiNav } from "@/components/admin/AdminApiNav";
import { AdminApiKeysView } from "@/components/admin/AdminApiKeysView";
import { getDevStore, getPlatformTimeZone } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminApiKeysPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const keys = getDevStore().apiKeys.map(({ keyHash: _h, ...rest }) => { void _h; return rest; });
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">API Keys</h1><p className="text-sm text-[var(--muted)]">Generate, view, and revoke keys</p></div>
      <AdminApiNav />
      <AdminApiKeysView keys={keys} timeZone={getPlatformTimeZone()} />
    </div>
  );
}
