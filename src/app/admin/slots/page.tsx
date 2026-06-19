import Link from "next/link";
import { Pencil } from "lucide-react";

import { FloorPlanMap } from "@/components/admin/FloorPlanMap";
import { buildFloorPlan } from "@/lib/admin/floor-plan";
import { getSlotConfig, getSlotLayout, getSlotStatuses, getSlotZones } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminSlotsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const u = session.effectiveUser;
  const data = buildFloorPlan({
    zones: getSlotZones(), layout: getSlotLayout(), statuses: getSlotStatuses(),
    config: getSlotConfig(), now: new Date().toISOString(),
  });
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold tracking-tight">Exhibition Floor Plan</h1><p className="text-sm text-[var(--muted)]">Live slot availability across every zone. Approve or release reservations.</p></div>
        <Link href="/admin/slots/layout" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--background)]"><Pencil className="size-4" /> Edit layout</Link>
      </div>
      <FloorPlanMap data={data} role={u.role} actor={u.reseller ?? u.name} isAdmin={u.role === "Super Admin"} />
    </div>
  );
}
