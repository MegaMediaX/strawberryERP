import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, maybeRouteToFrappe, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, clearDeleteQueue, getDeleteQueueRecord, resolveDeleteQueue } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { isClearAllConfirmed, type DeleteQueueAction } from "@/lib/admin/delete-queue";

/** §32 restore / permanently delete a single queued record — Super-Admin-only + audited. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { id?: string; action?: DeleteQueueAction };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }
  if (!payload.id || (payload.action !== "restore" && payload.action !== "permanent")) {
    return jsonError("A valid id and action ('restore' | 'permanent') are required.");
  }

  const existing = getDeleteQueueRecord(payload.id);
  if (!existing) return jsonError("Delete-queue record not found.", 404);
  if (existing.status !== "Pending") return jsonError("Only pending requests can be resolved.");

  const nextStatus = payload.action === "restore" ? "Restored" : "Permanently Deleted";

  // Resolve the queued record in Frappe when configured; otherwise fail loud (501).
  const proxied = await maybeRouteToFrappe("delete-queue", "patch", { name: payload.id, status: nextStatus });
  if (proxied) return proxied;

  const gated = writeRequiresBackend();
  if (gated) return gated;

  const updated = resolveDeleteQueue(payload.id, nextStatus);
  const audit = appendAudit({ entityType: "DeleteQueue", entityId: `${existing.entityType}:${existing.entityId}`, action: payload.action === "restore" ? "restore" : "permanent_delete", oldValue: "Pending", newValue: nextStatus, performedBy: session.auditLabel });
  return devStoreResponse({ record: updated, message: payload.action === "restore" ? "Record restored." : "Record permanently deleted." }, { audit });
}

/** §32 Clear All — high-risk; requires the typed confirmation phrase. */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { action?: string; confirm?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }
  if (payload.action !== "clear-all") return jsonError("Unsupported action.");
  if (!isClearAllConfirmed(payload.confirm ?? "")) return jsonError("Type \"CLEAR ALL\" to confirm permanent deletion of every pending request.");

  // Clear-all maps to resolve_delete_request(action="clear_all") in Frappe.
  const proxied = await maybeRouteToFrappe("delete-queue/resolve", "post", { action: "clear_all" });
  if (proxied) return proxied;

  const gated = writeRequiresBackend();
  if (gated) return gated;

  const cleared = clearDeleteQueue();
  const audit = appendAudit({ entityType: "DeleteQueue", entityId: "all", action: "clear_all", oldValue: `${cleared} pending`, newValue: "Permanently Deleted", performedBy: session.auditLabel });
  return devStoreResponse({ cleared, message: `Cleared ${cleared} request${cleared === 1 ? "" : "s"} — permanently deleted.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
