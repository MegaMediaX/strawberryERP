import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, appendSlotInvoiceLine, getSlotConfig, getSlotStatuses, setSlotStatus } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { applyTransition, normalizeExpiredHolds, type SlotAction } from "@/lib/admin/slot-status";

/**
 * §slots P3 — Super-Admin approval actions (approve / reject / release).
 * Super-Admin-only + audited. Transitions are server-authoritative; the acted
 * slot is normalized for expiry first (an expired hold can't be approved).
 */
const ADMIN_ACTIONS: SlotAction[] = ["approve", "reject", "release", "setInactive", "setActive"];

export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let p: { label?: string; action?: SlotAction };
  try { p = (await request.json()) as typeof p; } catch { return jsonError("Invalid request body."); }
  if (!p.label || !p.action || !ADMIN_ACTIONS.includes(p.action)) return jsonError("A valid slot label and action are required.");

  const now = new Date().toISOString();
  const config = getSlotConfig();
  const current = normalizeExpiredHolds(getSlotStatuses(), now, config.calendar)[p.label] ?? { status: "Available" as const };

  const result = applyTransition(current, p.action, { role: session.user.role, actor: session.user.name, now });
  if (!result.ok) return jsonError(result.error, 400);

  // §P4 — on approval, attach the slot as a line on the reseller's draft invoice.
  let draftInvoice: string | undefined;
  if (p.action === "approve" && result.next.heldBy) {
    draftInvoice = appendSlotInvoiceLine({ reseller: result.next.heldBy, label: p.label, price: config.priceBySlot[p.label] ?? 0, currency: config.currency });
    result.next.reservedInvoice = draftInvoice;
  }

  setSlotStatus(p.label, result.next);
  const audit = appendAudit({ entityType: "SlotStatus", entityId: p.label, action: p.action, oldValue: current.status, newValue: draftInvoice ? `${result.next.status} · ${draftInvoice}` : result.next.status, performedBy: session.auditLabel });
  return devStoreResponse({ slot: p.label, status: result.next, draftInvoice, message: `Slot ${p.label} → ${result.next.status}.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
