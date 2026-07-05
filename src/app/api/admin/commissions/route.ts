import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getCommissionEntry, updateCommissionEntry } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { evaluateCommissionApproval } from "@/lib/business/commission-approval";
import {
  COMMISSION_ACTION_STATUS,
  recalculateCommissionAmount,
  type AdminCommissionAction,
} from "@/lib/admin/commissions";

const ACTIONS: AdminCommissionAction[] = ["approve", "mark-paid", "recalculate", "cancel"];

/** §22 commission management — approve / mark-paid / recalculate / cancel. Super-Admin-only + audited. No DELETE. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { id?: string; action?: AdminCommissionAction };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const { id, action } = payload;
  if (!id || !action || !ACTIONS.includes(action)) return jsonError("A valid commission id and action are required.");

  const entry = getCommissionEntry(id);
  if (!entry) return jsonError("Commission not found.", 404);

  if (action === "recalculate") {
    const oldAmount = entry.commissionAmount;
    const newAmount = recalculateCommissionAmount(entry);

    const gate = writeRequiresBackend();
    if (gate) return gate;

    const updated = updateCommissionEntry(id, { commissionAmount: newAmount });
    const audit = appendAudit({ entityType: "Commission", entityId: id, action: "recalculate", oldValue: String(oldAmount), newValue: String(newAmount), performedBy: session.auditLabel });
    return devStoreResponse({ commission: updated, message: `Commission recalculated to ${newAmount.toLocaleString()}.` }, { audit });
  }

  const nextStatus = COMMISSION_ACTION_STATUS[action];
  const verdict = evaluateCommissionApproval(
    { role: session.user.role, countries: session.user.countries ?? [], reseller: session.user.reseller },
    { country: entry.country, reseller: entry.reseller, status: entry.status },
    nextStatus,
  );
  if (!verdict.ok) return jsonError(verdict.error, verdict.status);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const updated = updateCommissionEntry(id, { status: nextStatus });
  const audit = appendAudit({ entityType: "Commission", entityId: id, action: action === "approve" ? "approve" : action === "mark-paid" ? "mark-paid" : "cancel", oldValue: entry.status, newValue: nextStatus, performedBy: session.auditLabel });
  return devStoreResponse({ commission: updated, message: `Commission ${nextStatus.toLowerCase()}.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
