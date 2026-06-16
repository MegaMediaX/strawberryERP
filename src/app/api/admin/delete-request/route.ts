import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, enqueueDelete } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";

/** §32 admin-initiated deletion request → goes to the delete queue (never a hard delete). Audited. */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let p: { entityType?: string; entityId?: string; label?: string; reason?: string; country?: string; reseller?: string };
  try { p = (await request.json()) as typeof p; } catch { return jsonError("Invalid request body."); }
  if (!p.entityType || !p.entityId) return jsonError("entityType and entityId are required.");
  if (!p.reason?.trim()) return jsonError("A reason is required.");

  const queued = enqueueDelete({
    entityType: p.entityType,
    entityId: p.entityId,
    label: p.label?.trim() || p.entityId,
    requestedBy: session.user.name,
    reason: p.reason.trim(),
    role: session.user.role,
    country: p.country,
    reseller: p.reseller,
  });
  const audit = appendAudit({ entityType: "DeleteQueue", entityId: `${p.entityType}:${p.entityId}`, action: "request_delete", oldValue: "", newValue: "queued for deletion", performedBy: session.auditLabel });
  return devStoreResponse({ record: queued, message: "Deletion requested — added to the delete queue." }, { status: 201, audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
