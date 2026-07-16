import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, appendSlotInvoiceLine, removeSlotInvoiceLine } from "@/lib/dev-store";
import { persistSlotStatus, readFloorPlan } from "@/lib/admin/slots-persistence";
import { resolvePortalSession } from "@/lib/portal-security";
import { applyTransition, normalizeExpiredHolds, type SlotAction } from "@/lib/admin/slot-status";

/**
 * §slots P3 — Super-Admin slot actions (approve / reject / release /
 * setInactive / setActive). Super-Admin-only + audited. Transitions are
 * server-authoritative; the acted slot is normalized for expiry first (an
 * expired hold can't be approved). §P4: approve attaches a draft invoice line
 * and leaving Reserved removes it again.
 */
const ADMIN_ACTIONS: SlotAction[] = ["approve", "reject", "release", "setInactive", "setActive"];

export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let p: { label?: string; action?: SlotAction };
  try { p = (await request.json()) as typeof p; } catch { return jsonError("Invalid request body."); }
  if (!p.label || !p.action || !ADMIN_ACTIONS.includes(p.action)) return jsonError("A valid slot label and action are required.");

  const now = new Date().toISOString();
  const { config, layout, statuses } = await readFloorPlan();
  // Layout presence is the real gate (seeded catalog includes LB5-1 etc., which the
  // strict A1 grammar rejects); a label in the layout is by definition a valid booth.
  if (!p.label || !layout[p.label]) return jsonError("Unknown slot label.", 400);
  const current = normalizeExpiredHolds(statuses, now, config.calendar)[p.label] ?? { status: "Available" as const };

  const result = applyTransition(current, p.action, { role: session.user.role, actor: session.user.name, now });
  if (!result.ok) return jsonError(result.error, 400);

  // §P4 — on approval, attach the slot as a line on the reseller's draft invoice.
  let draftInvoice: string | undefined;
  if (p.action === "approve" && result.next.heldBy) {
    draftInvoice = appendSlotInvoiceLine({ reseller: result.next.heldBy, label: p.label, price: config.priceBySlot[p.label] ?? 0, currency: config.currency });
    result.next.reservedInvoice = draftInvoice;
  }

  // §P4 — and the inverse: a slot LEAVING Reserved must not strand that line.
  // Keyed on the state we're leaving, not on the action name, because two actions
  // reach it — release (→Available) and setInactive (→Inactive). `reject` never
  // does: it's only valid from OnHold, i.e. before approval created any line.
  // No Reserved→Reserved edge exists, so a Reserved `current` + an ok result
  // always means we are leaving Reserved.
  let removedInvoiceLine = false;
  if (current.status === "Reserved" && current.reservedInvoice) {
    removedInvoiceLine = removeSlotInvoiceLine({ invoiceId: current.reservedInvoice, label: p.label });
  }

  await persistSlotStatus(p.label, result.next);
  const auditValue = draftInvoice
    ? `${result.next.status} · ${draftInvoice}`
    : removedInvoiceLine
      ? `${result.next.status} · draft line removed from ${current.reservedInvoice}`
      : result.next.status;
  const audit = appendAudit({ entityType: "SlotStatus", entityId: p.label, action: p.action, oldValue: current.status, newValue: auditValue, performedBy: session.auditLabel });
  return devStoreResponse({ slot: p.label, status: result.next, draftInvoice, removedInvoiceLine, message: `Slot ${p.label} → ${result.next.status}.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
