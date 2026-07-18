import { frappeBackendClient } from "@/lib/backend/frappe-client";
import { isFrappeConfigured } from "@/lib/frappe-client";
import { defaultBusinessCalendar, type BusinessCalendar } from "@/lib/admin/business-hours";
import type { SlotConfig, SlotLayoutEntry, SlotZone } from "@/lib/admin/slots";
import type { SlotStatus, SlotStatusRecord } from "@/lib/admin/slot-status";
import {
  getPlatformTimeZone,
  getSlotConfig,
  getSlotLayout,
  getSlotStatuses,
  getSlotZones,
  setSlotConfig,
  setSlotLayout,
  setSlotStatus,
  setSlotZones,
} from "@/lib/dev-store";

/**
 * The single async seam for exhibition-slot persistence (APP-10 fix).
 *
 * Every slot read/write goes through here. When Frappe is configured AND the slot
 * DocTypes exist (post-migration), reads/writes route to the `slots.*` API methods
 * and are durable. Until then — Frappe unconfigured, or configured but not yet
 * migrated — everything falls back to the in-memory dev-store, unchanged. That
 * graceful fallback is deliberate: it lets the code deploy BEFORE the production
 * `bench migrate`, so the app never breaks in the window between the two.
 *
 * Callers work in the existing four-collection vocabulary (config / zones / layout
 * / statuses); the Frappe side stores one merged Exhibition Slot row per label and
 * this module adapts between the two shapes.
 */

export interface FloorPlanSnapshot {
  config: SlotConfig;
  zones: SlotZone[];
  layout: Record<string, SlotLayoutEntry>;
  statuses: Record<string, SlotStatusRecord>;
}

type FrappeSlotRow = {
  slot_label: string;
  zone?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  price?: number | null;
  is_active?: number | null;
  status?: string | null;
  held_by?: string | null;
  held_at?: string | null;
  reserved_invoice?: string | null;
  approved_by?: string | null;
  package?: string | null;
};

type FrappeFloorPlan = {
  config?: { slotsPerLetter?: number; currency?: string; calendarJson?: string; floorImageUrl?: string };
  zones?: Array<{ zone_id: string; zone_name?: string; sort_order?: number }>;
  slots?: FrappeSlotRow[];
};

function parseCalendar(json: string | undefined): BusinessCalendar {
  if (!json) return defaultBusinessCalendar(getPlatformTimeZone());
  try {
    const parsed = JSON.parse(json) as Partial<BusinessCalendar>;
    const base = defaultBusinessCalendar(getPlatformTimeZone());
    return {
      timezone: parsed.timezone || base.timezone,
      workingDays: Array.isArray(parsed.workingDays) ? parsed.workingDays : base.workingDays,
      startHour: typeof parsed.startHour === "number" ? parsed.startHour : base.startHour,
      endHour: typeof parsed.endHour === "number" ? parsed.endHour : base.endHour,
      holidays: Array.isArray(parsed.holidays) ? parsed.holidays : base.holidays,
    };
  } catch {
    return defaultBusinessCalendar(getPlatformTimeZone());
  }
}

/** Rebuild the four in-memory shapes from Frappe's merged rows. Exported for tests. */
export function adaptFrappeFloorPlan(data: FrappeFloorPlan): FloorPlanSnapshot {
  const rows = Array.isArray(data.slots) ? data.slots : [];
  const zones: SlotZone[] = (data.zones ?? [])
    .map((z) => ({ id: z.zone_id, name: z.zone_name ?? z.zone_id, order: z.sort_order ?? 0 }))
    .sort((a, b) => a.order - b.order);

  const layout: Record<string, SlotLayoutEntry> = {};
  const statuses: Record<string, SlotStatusRecord> = {};
  const priceBySlot: Record<string, number> = {};
  const activeSlots: string[] = [];

  for (const r of rows) {
    if (r.zone) layout[r.slot_label] = { zoneId: r.zone, x: r.pos_x ?? 0, y: r.pos_y ?? 0 };
    priceBySlot[r.slot_label] = typeof r.price === "number" ? r.price : 0;
    if (r.is_active) activeSlots.push(r.slot_label);
    statuses[r.slot_label] = {
      status: (r.status as SlotStatus) ?? "Available",
      heldBy: r.held_by ?? undefined,
      heldAt: r.held_at ?? undefined,
      reservedInvoice: r.reserved_invoice ?? undefined,
      approvedBy: r.approved_by ?? undefined,
      package: r.package ?? undefined,
    };
  }

  const config: SlotConfig = {
    slotsPerLetter: data.config?.slotsPerLetter ?? 6,
    activeSlots,
    priceBySlot,
    currency: data.config?.currency ?? "USD",
    floorImageUrl: data.config?.floorImageUrl || undefined,
    calendar: parseCalendar(data.config?.calendarJson),
  };

  return { config, zones, layout, statuses };
}

function readDevStore(): FloorPlanSnapshot {
  return {
    config: getSlotConfig(),
    zones: getSlotZones(),
    layout: getSlotLayout(),
    statuses: getSlotStatuses(),
  };
}

async function tryFrappe(resource: string, method: "get" | "post" | "patch", payload?: unknown): Promise<unknown | null> {
  if (!isFrappeConfigured()) return null;
  try {
    const result = await frappeBackendClient.handle({ resource, method, payload });
    if (!result) return null;
    // Frappe wraps every whitelisted-method return in { message: ... }. The client
    // passes that envelope through untouched, so unwrap it here — otherwise the
    // adapter sees { message: {...} } instead of { config, zones, slots } and the
    // whole floor plan (image + booths) comes back empty.
    const raw = result.data;
    const unwrapped = raw && typeof raw === "object" && "message" in raw ? (raw as { message: unknown }).message : raw;
    return unwrapped ?? true;
  } catch {
    // Frappe configured but the method/DocTypes are not there yet (pre-migration),
    // or a transient connection error: fall back rather than break the map.
    return null;
  }
}

/** Whole-map read for every role. Frappe when durable, else dev-store. */
export async function readFloorPlan(): Promise<FloorPlanSnapshot> {
  const data = await tryFrappe("slots/floor-plan", "get");
  if (data && typeof data === "object") return adaptFrappeFloorPlan(data as FrappeFloorPlan);
  return readDevStore();
}

/** Persist a single slot's status (hold / approve / release / …). */
export async function persistSlotStatus(label: string, record: SlotStatusRecord): Promise<void> {
  const routed = await tryFrappe("slots/status", "post", {
    label,
    status: record.status,
    heldBy: record.heldBy ?? null,
    heldAt: record.heldAt ?? null,
    reservedInvoice: record.reservedInvoice ?? null,
    approvedBy: record.approvedBy ?? null,
  });
  if (!routed) setSlotStatus(label, record);
}

/** Persist a Super-Admin floor-plan save (zones + layout + prices + active). */
export async function persistLayout(input: {
  zones: SlotZone[];
  layout: Record<string, SlotLayoutEntry>;
  activeSlots: string[];
  priceBySlot: Record<string, number>;
}): Promise<void> {
  const routed = await tryFrappe("slots/layout", "post", {
    zones: input.zones.map((z) => ({ id: z.id, name: z.name })),
    layout: input.layout,
    activeSlots: input.activeSlots,
    priceBySlot: input.priceBySlot,
  });
  if (!routed) {
    setSlotZones(input.zones);
    setSlotLayout(input.layout);
    setSlotConfig({ activeSlots: input.activeSlots, priceBySlot: input.priceBySlot });
  }
}
