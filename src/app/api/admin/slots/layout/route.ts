import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit } from "@/lib/dev-store";
import { persistLayout, readFloorPlan } from "@/lib/admin/slots-persistence";
import { resolvePortalSession } from "@/lib/portal-security";
import { isPlaceableSlotLabel, type SlotLayoutEntry, type SlotZone } from "@/lib/admin/slots";

interface SavePayload {
  zones?: SlotZone[];
  layout?: Record<string, SlotLayoutEntry>;
  activeSlots?: string[];
  priceBySlot?: Record<string, number>;
}

/** §slots P2 — save the floor-plan layout. Super-Admin-only + audited. No-DELETE. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let p: SavePayload;
  try { p = (await request.json()) as SavePayload; } catch { return jsonError("Invalid request body."); }
  if (!Array.isArray(p.zones) || typeof p.layout !== "object" || !p.layout) return jsonError("zones and layout are required.");

  const { config } = await readFloorPlan();
  const zoneIds = new Set(p.zones.map((z) => z.id));

  for (const [label, pos] of Object.entries(p.layout)) {
    if (!isPlaceableSlotLabel(label)) return jsonError(`Invalid slot label: ${label}.`);
    if (!zoneIds.has(pos.zoneId)) return jsonError(`Slot ${label} references an unknown zone.`);
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || pos.x < 0 || pos.y < 0) return jsonError(`Slot ${label} has an invalid position.`);
  }
  // No two slots may occupy the same cell in the same zone.
  const seen = new Set<string>();
  for (const [, pos] of Object.entries(p.layout)) {
    const key = `${pos.zoneId}:${pos.x},${pos.y}`;
    if (seen.has(key)) return jsonError("Two slots cannot occupy the same cell.");
    seen.add(key);
  }
  if (p.priceBySlot && Object.values(p.priceBySlot).some((v) => typeof v === "number" && v < 0)) {
    return jsonError("Slot prices cannot be negative.");
  }

  await persistLayout({
    zones: p.zones.map((z, i) => ({ id: z.id, name: String(z.name).trim() || `Zone ${i + 1}`, order: i })),
    layout: p.layout,
    activeSlots: p.activeSlots ?? config.activeSlots,
    priceBySlot: p.priceBySlot ?? config.priceBySlot,
  });

  const audit = appendAudit({ entityType: "SlotLayout", entityId: "floor-plan", action: "update", oldValue: "", newValue: `${Object.keys(p.layout).length} slots across ${p.zones.length} zones`, performedBy: session.auditLabel });
  return devStoreResponse({ zones: p.zones, layout: p.layout, message: "Floor-plan layout saved." }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
