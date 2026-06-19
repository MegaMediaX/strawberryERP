import { FloorPlanMap } from "@/components/admin/FloorPlanMap";
import { buildFloorPlan } from "@/lib/admin/floor-plan";
import { getSlotConfig, getSlotLayout, getSlotStatuses, getSlotZones } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function ResellerExhibitionPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const u = session.effectiveUser;
  const data = buildFloorPlan({
    zones: getSlotZones(), layout: getSlotLayout(), statuses: getSlotStatuses(),
    config: getSlotConfig(), now: new Date().toISOString(),
  });
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Exhibition Floor Plan</h1><p className="text-sm text-[var(--muted)]">Hold an available slot for your customers — Super Admin confirms it within 24 working hours.</p></div>
      <FloorPlanMap data={data} role={u.role} actor={u.reseller ?? u.name} isAdmin={false} />
    </div>
  );
}
