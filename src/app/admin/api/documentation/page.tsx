import { AdminApiNav } from "@/components/admin/AdminApiNav";
import { AdminApiDocsView } from "@/components/admin/AdminApiDocsView";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminApiDocsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">API Documentation</h1><p className="text-sm text-[var(--muted)]">OpenAPI-style reference</p></div>
      <AdminApiNav />
      <AdminApiDocsView />
    </div>
  );
}
