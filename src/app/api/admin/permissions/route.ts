import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, setPermissionMatrix } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validatePermissionMatrix, type PermissionMatrix } from "@/lib/admin/permission-matrix";

/** §44 save the permission matrix — Super-Admin-only + audited. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let matrix: PermissionMatrix;
  try { matrix = (await request.json()) as PermissionMatrix; } catch { return jsonError("Invalid request body."); }

  const invalid = validatePermissionMatrix(matrix);
  if (invalid) return jsonError(invalid);

  const saved = setPermissionMatrix(matrix);
  const audit = appendAudit({ entityType: "Permissions", entityId: "matrix", action: "update", oldValue: "", newValue: "role permissions updated", performedBy: session.auditLabel });
  return devStoreResponse({ matrix: saved, message: "Role permissions saved." }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
