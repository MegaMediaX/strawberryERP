import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, applyLeadOverride, enqueueDelete } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { leads as seedLeads } from "@/lib/sample-data";
import { leadActionAudit, validateReassign, type AdminLeadAction } from "@/lib/admin/admin-leads";

/**
 * §13/§14 Super Admin lead actions: reassign / convert / archive / delete. All
 * Super-Admin-only and audited. Archive + Delete route through the dev-store
 * delete-queue (enqueueDelete) — NEVER a hard delete.
 */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { leadId?: string; action?: AdminLeadAction; assignedTo?: string; reason?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const lead = seedLeads.find((l) => l.id === payload.leadId);
  if (!lead) return jsonError("Lead not found.", 404);
  const action = payload.action;

  if (action === "reassign") {
    const invalid = validateReassign(payload.assignedTo);
    if (invalid) return jsonError(invalid);
    const gated = writeRequiresBackend();
    if (gated) return gated;
    applyLeadOverride(lead.id, { assignedTo: payload.assignedTo });
    const a = leadActionAudit("reassign", `${lead.company}: ${lead.assignedTo} → ${payload.assignedTo}`);
    const audit = appendAudit({ entityType: "Lead", entityId: lead.id, action: a.action, oldValue: lead.assignedTo, newValue: a.newValue, performedBy: session.auditLabel });
    return devStoreResponse({ message: `${lead.company} reassigned to ${payload.assignedTo}.` }, { audit });
  }

  if (action === "convert") {
    const gated = writeRequiresBackend();
    if (gated) return gated;
    applyLeadOverride(lead.id, { convertedAt: new Date().toISOString() });
    const a = leadActionAudit("convert", `${lead.company} marked converted to customer`);
    const audit = appendAudit({ entityType: "Lead", entityId: lead.id, action: a.action, oldValue: lead.status, newValue: a.newValue, performedBy: session.auditLabel });
    return devStoreResponse({ message: `${lead.company} converted.` }, { audit });
  }

  if (action === "archive" || action === "delete") {
    const gated = writeRequiresBackend();
    if (gated) return gated;
    applyLeadOverride(lead.id, { archived: true });
    enqueueDelete({ entityType: "Lead", entityId: lead.id, label: `${lead.company} (${lead.reseller})`, requestedBy: session.auditLabel, reason: payload.reason?.trim() || (action === "archive" ? "Archived by Super Admin" : "Permanent delete requested by Super Admin") });
    const a = leadActionAudit(action, `${lead.company} → delete queue`);
    const audit = appendAudit({ entityType: "Lead", entityId: lead.id, action: a.action, oldValue: "", newValue: a.newValue, performedBy: session.auditLabel });
    return devStoreResponse({ message: `${lead.company} moved to the delete queue.` }, { audit });
  }

  return jsonError("Unknown action.");
}

export function DELETE() {
  return deleteNotAllowed();
}
