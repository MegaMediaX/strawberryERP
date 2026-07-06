import { type NextResponse } from "next/server";

import { jsonError } from "@/lib/api-helpers";
import { resolvePortalSession, type PortalSession } from "@/lib/portal-security";

/**
 * Shared Super-Admin gate for `/api/admin/*` routes (APP-11 — de-duplicates the
 * ~24 inline `resolvePortalSession` + `role !== "Super Admin"` checks and the
 * three copy-pasted local `ensureSuperAdmin` helpers).
 *
 * Uses the REAL `session.user.role` (not `effectiveUser`) so a genuine Super
 * Admin keeps admin access during an active Login-As / impersonation, matching
 * the prior per-route behavior exactly.
 *
 * Usage:
 *   const { denied, session } = requireSuperAdmin(request);
 *   if (denied) return denied;
 *   // ... use `session`
 */
export function requireSuperAdmin(
  request: Request,
): { denied: NextResponse; session: PortalSession } | { denied: null; session: PortalSession } {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") {
    return { denied: jsonError("Super Admin only.", 403), session };
  }
  return { denied: null, session };
}
