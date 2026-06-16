import { AdminProfileView } from "@/components/admin/AdminProfileView";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminProfilePage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const u = session.effectiveUser;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Profile</h1><p className="text-sm text-[var(--muted)]">Your account and access level</p></div>
      <AdminProfileView name={u.name} email={u.email} twoFactor={Boolean((u as { twoFactorEnabled?: boolean }).twoFactorEnabled)} />
    </div>
  );
}
