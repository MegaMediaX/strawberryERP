import { AdminSlotLayoutEditor } from "@/components/admin/AdminSlotLayoutEditor";
import { getSlotCatalog, getSlotConfig, getSlotLayout, getSlotZones } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminSlotLayoutPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Exhibition Floor — Layout</h1><p className="text-sm text-[var(--muted)]">Drag slots into zones, set price + availability. Resellers reserve against this layout.</p></div>
      <AdminSlotLayoutEditor catalog={getSlotCatalog()} config={structuredClone(getSlotConfig())} zones={[...getSlotZones()]} layout={structuredClone(getSlotLayout())} />
    </div>
  );
}
