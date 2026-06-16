import { AdminCustomFieldsView } from "@/components/admin/AdminCustomFieldsView";
import { getCustomFields } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCustomFieldsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Custom Fields</h1><p className="text-sm text-[var(--muted)]">Add fields per module — they appear automatically in forms</p></div>
      <AdminCustomFieldsView fields={getCustomFields().map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }))} />
    </div>
  );
}
