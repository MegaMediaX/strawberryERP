import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-helpers";
import { appendAudit, getDevStore } from "@/lib/dev-store";
import { IMPERSONATE_COOKIE, resolvePortalSession } from "@/lib/portal-security";
import { validateLoginAsReason } from "@/lib/admin/resellers";

/**
 * §12 Login-As / impersonation. Only the real authenticated Super Admin may
 * start it; the target must be a lower-rank active user. Sets a session cookie
 * (browser-navigable) so the impersonation persists across pages, and audits
 * the action with the supplied reason. DELETE = exit impersonation.
 */
const HOME: Record<string, string> = {
  "Reseller Admin": "/reseller/dashboard",
  "Regional Director": "/regional/dashboard",
  "Sales Team User": "/sales/dashboard",
};

function cookieOpts() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
}

export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Only a Super Admin can impersonate.", 403);

  let payload: { targetUserId?: string; reason?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const reasonError = validateLoginAsReason(payload.reason);
  if (reasonError) return jsonError(reasonError);

  const target = getDevStore().users.find((u) => u.id === payload.targetUserId && u.active);
  if (!target) return jsonError("That user no longer exists or is inactive.", 404);
  if (target.role === "Super Admin") return jsonError("Cannot impersonate another Super Admin.", 400);

  const audit = appendAudit({
    entityType: "User", entityId: target.id, action: "login_as",
    oldValue: "", newValue: `${target.name} (${target.role})${target.reseller ? ` · ${target.reseller}` : ""} — reason: ${payload.reason!.trim()}`,
    performedBy: `${session.user.name} as Super Admin`,
  });

  const res = NextResponse.json({ ok: true, data: { redirect: HOME[target.role] ?? "/", message: `Now viewing as ${target.name}.` }, audit });
  res.cookies.set(IMPERSONATE_COOKIE, target.id, cookieOpts());
  return res;
}

export async function DELETE(request: Request) {
  const session = resolvePortalSession(request);
  // The real (authenticated) user is always the Super Admin; clear regardless.
  if (session.impersonatedBy) {
    appendAudit({ entityType: "User", entityId: session.effectiveUser.id, action: "exit_login_as", oldValue: session.effectiveUser.name, newValue: "", performedBy: `${session.impersonatedBy.name} as Super Admin` });
  }
  const res = NextResponse.json({ ok: true, data: { redirect: "/admin/resellers" } });
  res.cookies.set(IMPERSONATE_COOKIE, "", { ...cookieOpts(), maxAge: 0 });
  return res;
}
