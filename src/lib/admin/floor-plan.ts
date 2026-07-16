import { holdExpiresAt } from "@/lib/admin/business-hours";
import { normalizeExpiredHolds, type SlotStatus } from "@/lib/admin/slot-status";
import type { BusinessCalendar } from "@/lib/admin/business-hours";
import type { SlotConfig, SlotLayoutEntry, SlotZone } from "@/lib/admin/slots";
import type { SlotStatusRecord } from "@/lib/admin/slot-status";
import { HOLD_WORKING_HOURS } from "@/lib/admin/slot-status";

/**
 * Exhibition Floor Plan view-model (P3). Pure assembly of the saved layout +
 * live statuses (after compute-on-read expiry). Used by the read-only map for
 * every role. `now` is injected so it stays deterministic + testable.
 */

export interface FloorPlanSlot {
  label: string;
  zoneId: string;
  x: number;
  y: number;
  status: SlotStatus;
  heldBy?: string;
  heldAt?: string;
  approvedBy?: string;
  reservedInvoice?: string;
  price: number;
  active: boolean;
  /** ISO instant the hold lapses (OnHold only) — for the working-hours countdown. */
  expiresAt?: string;
}

export interface FloorPlanData {
  zones: SlotZone[];
  slots: FloorPlanSlot[];
  calendar: BusinessCalendar;
  /** When set, the map renders this venue image with booths at their normalized
   * (0-1) x/y. Empty = the abstract zone-grid map. */
  floorImageUrl?: string;
}

export function buildFloorPlan(input: {
  zones: SlotZone[];
  layout: Record<string, SlotLayoutEntry>;
  statuses: Record<string, SlotStatusRecord>;
  config: SlotConfig;
  now: string;
}): FloorPlanData {
  const live = normalizeExpiredHolds(input.statuses, input.now, input.config.calendar);
  const activeSet = new Set(input.config.activeSlots);

  const slots: FloorPlanSlot[] = Object.entries(input.layout).map(([label, pos]) => {
    const rec = live[label] ?? { status: "Available" as SlotStatus };
    const isActive = activeSet.has(label);
    const status: SlotStatus = isActive ? rec.status : "Inactive";
    // When config forces a slot Inactive, don't leak the stale hold fields.
    const showHold = isActive && (rec.status === "OnHold" || rec.status === "Reserved");
    return {
      label,
      zoneId: pos.zoneId,
      x: pos.x,
      y: pos.y,
      status,
      heldBy: showHold ? rec.heldBy : undefined,
      heldAt: showHold ? rec.heldAt : undefined,
      approvedBy: showHold ? rec.approvedBy : undefined,
      reservedInvoice: showHold ? rec.reservedInvoice : undefined,
      price: input.config.priceBySlot[label] ?? 0,
      active: isActive,
      expiresAt: status === "OnHold" && rec.heldAt ? holdExpiresAt(rec.heldAt, HOLD_WORKING_HOURS, input.config.calendar) : undefined,
    };
  });

  return {
    zones: [...input.zones].sort((a, b) => a.order - b.order),
    slots,
    calendar: input.config.calendar,
    floorImageUrl: input.config.floorImageUrl || undefined,
  };
}

/** Status tallies for the legend / summary. */
export function floorPlanCounts(data: FloorPlanData): Record<SlotStatus, number> {
  const counts: Record<SlotStatus, number> = { Available: 0, OnHold: 0, Reserved: 0, Inactive: 0 };
  for (const s of data.slots) counts[s.status] += 1;
  return counts;
}
