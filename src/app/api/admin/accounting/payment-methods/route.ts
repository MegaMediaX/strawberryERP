import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, upsertPaymentMethod } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validatePaymentMethod } from "@/lib/business/payment-methods";
import type { PaymentMethod } from "@/lib/phase2-data";

/** Map a PaymentMethod to the Frappe "Payment Method" doctype payload. */
function toFrappePaymentMethod(m: PaymentMethod) {
  return {
    method_name: m.methodName,
    is_active: m.isActive ? 1 : 0,
    countries: JSON.stringify(m.countries),
    resellers: JSON.stringify(m.resellers),
    requires_reference: m.requiresReference ? 1 : 0,
    requires_attachment: m.requiresAttachment ? 1 : 0,
    display_order: m.displayOrder,
    icon: m.icon,
  };
}

/** §19 payment methods — enable/disable + edit. Super-Admin-only + audited. Disable, never delete. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: Partial<PaymentMethod>;
  try { payload = (await request.json()) as Partial<PaymentMethod>; } catch { return jsonError("Invalid request body."); }

  const current = getDevStore().paymentMethods.find((m) => m.methodName === payload.methodName);
  if (!current) return jsonError("Payment method not found.", 404);

  const merged: PaymentMethod = {
    ...current,
    isActive: payload.isActive ?? current.isActive,
    countries: payload.countries ?? current.countries,
    resellers: payload.resellers ?? current.resellers,
    requiresReference: payload.requiresReference ?? current.requiresReference,
    requiresAttachment: payload.requiresAttachment ?? current.requiresAttachment,
    displayOrder: payload.displayOrder ?? current.displayOrder,
    icon: payload.icon ?? current.icon,
  };
  const invalid = validatePaymentMethod(merged);
  if (invalid) return jsonError(invalid);

  const proxied = await maybeRouteToFrappe("payment-methods", "patch", toFrappePaymentMethod(merged));
  if (proxied) return proxied;

  upsertPaymentMethod(merged);
  const audit = appendAudit({ entityType: "PaymentMethod", entityId: merged.methodName, action: current.isActive !== merged.isActive ? (merged.isActive ? "enable" : "disable") : "update", oldValue: String(current.isActive), newValue: String(merged.isActive), performedBy: session.auditLabel });
  return devStoreResponse({ method: merged, message: `${merged.methodName} saved.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
