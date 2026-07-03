import { AdminLeadsView } from "@/components/admin/AdminLeadsView";
import { getUsers } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;
  const leadsResult = await getUiLeads(session);
  const assignees = getUsers().filter((u) => u.active && (u.role === "Sales Team User" || u.role === "Reseller Admin")).map((u) => u.name);

  // Forward-link intent (dashboard KPIs, reseller/country cross-links): let an
  // explicit query param seed the filters so the landing list matches the click.
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const initialFilters = {
    status: pick("status"),
    reseller: pick("reseller"),
    assignedUser: pick("assignedUser"),
    priority: pick("priority"),
    country: pick("country"),
    search: pick("search"),
  };

  return <AdminLeadsView leads={leadsResult.data} assignees={assignees} initialFilters={initialFilters} />;
}
