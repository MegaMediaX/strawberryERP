import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, applyCustomerOverride, enqueueDelete } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { customers as seedCustomers } from "@/lib/phase2-data";
import { customerActionAudit, validateCustomerNote, type AdminCustomerAction } from "@/lib/admin/admin-customers";

/**
 * §15/§16 Super Admin customer actions: add-note / delete. Super-Admin-only and
 * audited. Delete routes through the dev-store delete-queue (enqueueDelete) —
 * NEVER a hard delete.
 */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { customerId?: string; action?: AdminCustomerAction; note?: string; reason?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const customer = seedCustomers.find((c) => c.id === payload.customerId);
  if (!customer) return jsonError("Customer not found.", 404);

  if (payload.action === "add_note") {
    const invalid = validateCustomerNote(payload.note);
    if (invalid) return jsonError(invalid);
    applyCustomerOverride(customer.id, { notes: [payload.note!.trim()] });
    const a = customerActionAudit("add_note", `${customer.name}: ${payload.note!.trim().slice(0, 80)}`);
    const audit = appendAudit({ entityType: "Customer", entityId: customer.id, action: a.action, oldValue: "", newValue: a.newValue, performedBy: session.auditLabel });
    return devStoreResponse({ message: `Note added to ${customer.name}.` }, { audit });
  }

  if (payload.action === "delete") {
    applyCustomerOverride(customer.id, { archived: true });
    enqueueDelete({ entityType: "Customer", entityId: customer.id, label: `${customer.name} (${customer.reseller})`, requestedBy: session.auditLabel, reason: payload.reason?.trim() || "Permanent delete requested by Super Admin" });
    const a = customerActionAudit("delete", `${customer.name} → delete queue`);
    const audit = appendAudit({ entityType: "Customer", entityId: customer.id, action: a.action, oldValue: "", newValue: a.newValue, performedBy: session.auditLabel });
    return devStoreResponse({ message: `${customer.name} moved to the delete queue.` }, { audit });
  }

  return jsonError("Unknown action.");
}

export function DELETE() {
  return deleteNotAllowed();
}
