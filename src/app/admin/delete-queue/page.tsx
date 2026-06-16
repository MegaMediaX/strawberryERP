import { AdminDeleteQueueView } from "@/components/admin/AdminDeleteQueueView";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminDeleteQueuePage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Delete Queue</h1><p className="text-sm text-[var(--muted)]">Review deletion requests — restore or permanently delete (high-risk)</p></div>
      <AdminDeleteQueueView records={[...getDevStore().deleteQueue]} />
    </div>
  );
}
