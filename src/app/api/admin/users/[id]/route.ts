import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getUserById, setUserActive, updateUserScope } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validatePasswordReset } from "@/lib/admin/users";

/**
 * §11 per-user actions: reset password, deactivate/activate, edit scope. All
 * Super-Admin-only and audited. Password reset is dev-store-simulated (no real
 * credential write). No-DELETE.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  const { id } = await params;
  const current = getUserById(id);
  if (!current) return jsonError("User not found.", 404);

  let payload: { action?: string; password?: string; active?: boolean; countries?: string[]; reseller?: string; phone?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  if (payload.action === "reset_password") {
    const invalid = validatePasswordReset(String(payload.password ?? ""));
    if (invalid) return jsonError(invalid);
    // A real password reset requires the configured backend — gate here so an
    // unconfigured backend can't fake a credential change.
    const gated = writeRequiresBackend();
    if (gated) return gated;
    const audit = appendAudit({ entityType: "User", entityId: id, action: "reset_password", oldValue: "—", newValue: "********", performedBy: session.auditLabel });
    return devStoreResponse({ message: `Password reset submitted for ${current.name}.` }, { audit });
  }

  if (typeof payload.active === "boolean" || payload.action === "deactivate" || payload.action === "activate") {
    if (current.role === "Super Admin") return jsonError("A Super Admin account cannot be deactivated here.", 400);
    const active = payload.action === "activate" ? true : payload.action === "deactivate" ? false : Boolean(payload.active);
    const gated = writeRequiresBackend();
    if (gated) return gated;
    const updated = setUserActive(id, active);
    const audit = appendAudit({ entityType: "User", entityId: id, action: active ? "activate" : "deactivate", oldValue: String(current.active), newValue: String(active), performedBy: session.auditLabel });
    return devStoreResponse({ user: updated, message: `${current.name} ${active ? "activated" : "deactivated"}.` }, { audit });
  }

  // Edit scope.
  const gated = writeRequiresBackend();
  if (gated) return gated;
  const updated = updateUserScope(id, { countries: payload.countries, reseller: payload.reseller, ...(payload.phone !== undefined ? { phone: payload.phone } : {}) });
  const audit = appendAudit({ entityType: "User", entityId: id, action: "update", oldValue: `${current.countries.join(", ")}${current.reseller ? ` · ${current.reseller}` : ""}`, newValue: `${(payload.countries ?? current.countries).join(", ")}${(payload.reseller ?? current.reseller) ? ` · ${payload.reseller ?? current.reseller}` : ""}`, performedBy: session.auditLabel });
  return devStoreResponse({ user: updated, message: `${current.name} updated.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
