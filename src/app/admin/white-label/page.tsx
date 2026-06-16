import { AdminWhiteLabelView } from "@/components/admin/AdminWhiteLabelView";
import { getWhiteLabel } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminWhiteLabelPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">White Label</h1><p className="text-sm text-[var(--muted)]">Sell the platform as your own — identity, tenant branding rules, module availability</p></div>
      <AdminWhiteLabelView settings={{ ...getWhiteLabel() }} />
    </div>
  );
}
