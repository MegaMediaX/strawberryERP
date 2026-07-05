import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, appendUser, getDevStore } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { buildUser, validateAdminUser, type AdminUserFormInput } from "@/lib/admin/users";

/**
 * Super Admin user management (spec §11). Super-Admin-only; create writes a
 * dev-store user + audit. Passwords are dev-store-simulated (no real credential
 * store). No-DELETE — users are deactivated, never removed.
 */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let input: AdminUserFormInput;
  try { input = (await request.json()) as AdminUserFormInput; } catch { return jsonError("Invalid request body."); }

  const store = getDevStore();
  const invalid = validateAdminUser(input, { existingEmails: store.users.map((u) => u.email), isEdit: false });
  if (invalid) return jsonError(invalid);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const built = buildUser(input, String(Date.now()));
  appendUser({ id: built.id, name: built.name, email: built.email, role: built.role, reseller: built.reseller, countries: built.countries as never, active: true });
  const audit = appendAudit({ entityType: "User", entityId: built.id, action: "create_user", oldValue: "", newValue: `${built.name} · ${built.role}${built.reseller ? ` · ${built.reseller}` : ""}${built.countries.length ? ` · ${built.countries.join(", ")}` : ""}`, performedBy: session.auditLabel });
  return devStoreResponse({ user: built, message: `User "${built.name}" created.` }, { status: 201, audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
