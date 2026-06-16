import { AdminBrandingView } from "@/components/admin/AdminBrandingView";
import { getWhiteLabel } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminBrandingPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Branding</h1><p className="text-sm text-[var(--muted)]">Tune the global brand with a live preview across every surface</p></div>
      <AdminBrandingView settings={{ ...getWhiteLabel() }} />
    </div>
  );
}
