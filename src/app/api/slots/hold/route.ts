import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, getSlotConfig, getSlotLayout, getSlotStatuses, setSlotStatus } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { applyTransition, normalizeExpiredHolds, type SlotAction } from "@/lib/admin/slot-status";
import { parseSlot } from "@/lib/admin/slots";

/**
 * §slots P3 — reseller hold actions (requestHold / cancel). Role-gated via the
 * pure state machine (fail-closed); transitions are server-authoritative. The
 * acted slot is normalized for expiry first (compute-on-read). No-DELETE.
 */
const RESELLER_ACTIONS: SlotAction[] = ["requestHold", "cancel"];

export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  let p: { label?: string; action?: SlotAction };
  try { p = (await request.json()) as typeof p; } catch { return jsonError("Invalid request body."); }
  if (!p.label || !p.action || !RESELLER_ACTIONS.includes(p.action)) return jsonError("A valid slot label and action are required.");
  if (!parseSlot(p.label) || !getSlotLayout()[p.label]) return jsonError("Unknown slot label.", 400);

  const now = new Date().toISOString();
  const config = getSlotConfig();
  const current = normalizeExpiredHolds(getSlotStatuses(), now, config.calendar)[p.label] ?? { status: "Available" as const };
  // Act AS the effective user: a Super Admin impersonating a reseller holds as
  // that reseller; a genuine reseller holds as themselves. A real (non-
  // impersonating) Super Admin is still blocked by canActOnSlot.
  const acting = session.effectiveUser;
  const actor = acting.reseller ?? acting.name;

  const result = applyTransition(current, p.action, { role: acting.role, actor, now });
  if (!result.ok) return jsonError(result.error, 403);

  setSlotStatus(p.label, result.next);
  const audit = appendAudit({ entityType: "SlotHold", entityId: p.label, action: p.action === "requestHold" ? "hold" : "cancel", oldValue: current.status, newValue: result.next.status, performedBy: session.auditLabel });
  return devStoreResponse({ slot: p.label, status: result.next, message: p.action === "requestHold" ? `Slot ${p.label} held — pending Super Admin approval.` : `Hold on ${p.label} cancelled.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
