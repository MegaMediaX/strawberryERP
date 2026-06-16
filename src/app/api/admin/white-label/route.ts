import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, getWhiteLabel, setWhiteLabel } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { mergeWhiteLabel, validateWhiteLabel, type WhiteLabelSettings } from "@/lib/admin/white-label";

/** §30 save white-label / branding settings — Super-Admin-only, audited. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let patch: Partial<WhiteLabelSettings>;
  try { patch = (await request.json()) as Partial<WhiteLabelSettings>; } catch { return jsonError("Invalid request body."); }

  const merged = mergeWhiteLabel(getWhiteLabel(), patch);
  const invalid = validateWhiteLabel(merged);
  if (invalid) return jsonError(invalid);

  const updated = setWhiteLabel(patch);
  const audit = appendAudit({ entityType: "WhiteLabel", entityId: "platform", action: "update", oldValue: "", newValue: `${updated.platformName} · ${updated.enabledModules.length} modules`, performedBy: session.auditLabel });
  return devStoreResponse({ whiteLabel: updated, message: "White-label settings saved." }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
