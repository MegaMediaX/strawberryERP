import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit } from "@/lib/dev-store";
import { persistSlotStatus, readFloorPlan } from "@/lib/admin/slots-persistence";
import { resolvePortalSession } from "@/lib/portal-security";
import { applyTransition, normalizeExpiredHolds, type SlotAction } from "@/lib/admin/slot-status";

/**
 * §slots P3 — reseller hold actions (requestHold / cancel). Role-gated via the
 * pure state machine (fail-closed); transitions are server-authoritative. The
 * acted slot is normalized for expiry first (compute-on-read). No-DELETE.
 */
const RESELLER_ACTIONS: SlotAction[] = ["requestHold", "cancel"];

export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  // Fail-closed transport gate (SEC-1): an unauthenticated request must never
  // reach the state machine, even though canActOnSlot would also deny the
  // anonymous role for most actions. Checked before any body parsing or state
  // mutation.
  if (session.authenticated !== true) return jsonError("Authentication required.", 401);

  let p: { label?: string; action?: SlotAction };
  try { p = (await request.json()) as typeof p; } catch { return jsonError("Invalid request body."); }
  if (!p.label || !p.action || !RESELLER_ACTIONS.includes(p.action)) return jsonError("A valid slot label and action are required.");

  const now = new Date().toISOString();
  const { config, layout, statuses } = await readFloorPlan();
  // The seeded layout is the source of truth for valid labels (incl. LB5-1 etc.);
  // own-property presence is the gate. Object.hasOwn + a string check so a
  // prototype key ("__proto__", "constructor") or a non-string payload can't
  // spoof the gate — defense in depth ahead of the state machine.
  if (typeof p.label !== "string" || !Object.hasOwn(layout, p.label)) return jsonError("Unknown slot label.", 400);
  const current = normalizeExpiredHolds(statuses, now, config.calendar)[p.label] ?? { status: "Available" as const };
  // Act AS the effective user: a Super Admin impersonating a reseller holds as
  // that reseller; a genuine reseller holds as themselves. A real (non-
  // impersonating) Super Admin holds as themselves too (GAP-2 parity) — their
  // own hold, cancellable only by them, since canActOnSlot keeps cancel
  // ownership-bound.
  const acting = session.effectiveUser;
  const actor = acting.reseller ?? acting.name;

  const result = applyTransition(current, p.action, { role: acting.role, actor, now });
  if (!result.ok) return jsonError(result.error, 403);

  // Persisted via the slot seam: Frappe when configured (durable, APP-10 fixed),
  // else in-memory dev-store. The response source reflects which one handled it.
  await persistSlotStatus(p.label, result.next);
  const audit = appendAudit({ entityType: "SlotHold", entityId: p.label, action: p.action === "requestHold" ? "hold" : "cancel", oldValue: current.status, newValue: result.next.status, performedBy: session.auditLabel });
  return devStoreResponse({ slot: p.label, status: result.next, message: p.action === "requestHold" ? `Slot ${p.label} held — pending Super Admin approval.` : `Hold on ${p.label} cancelled.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
