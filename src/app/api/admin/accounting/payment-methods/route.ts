import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, upsertPaymentMethod } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validatePaymentMethod } from "@/lib/business/payment-methods";
import type { PaymentMethod } from "@/lib/phase2-data";

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

  const gate = writeRequiresBackend();
  if (gate) return gate;

  upsertPaymentMethod(merged);
  const audit = appendAudit({ entityType: "PaymentMethod", entityId: merged.methodName, action: current.isActive !== merged.isActive ? (merged.isActive ? "enable" : "disable") : "update", oldValue: String(current.isActive), newValue: String(merged.isActive), performedBy: session.auditLabel });
  return devStoreResponse({ method: merged, message: `${merged.methodName} saved.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
