import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminSlotApprovalsView } from "@/components/admin/AdminSlotApprovalsView";
import { buildFloorPlan } from "@/lib/admin/floor-plan";
import { readFloorPlan } from "@/lib/admin/slots-persistence";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminSlotApprovalsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const snapshot = await readFloorPlan();
  const data = buildFloorPlan({ ...snapshot, now: new Date().toISOString() });
  const pending = data.slots.filter((s) => s.status === "OnHold");
  const zoneNames = Object.fromEntries(data.zones.map((z) => [z.id, z.name]));
  return (
    <div className="grid gap-5">
      <Link href="/admin/slots" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"><ArrowLeft className="size-4" /> Back to floor plan</Link>
      <div><h1 className="text-xl font-bold tracking-tight">Slot Reservations &amp; Approvals</h1><p className="text-sm text-[var(--muted)]">{pending.length} hold{pending.length === 1 ? "" : "s"} pending Super Admin confirmation</p></div>
      <AdminSlotApprovalsView pending={pending} zoneNames={zoneNames} timeZone={data.calendar.timezone} />
    </div>
  );
}
