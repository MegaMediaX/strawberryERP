import type { CommissionStatus } from "@/lib/phase2-data";
import type { PortalRole } from "@/lib/portal-security";

/**
 * Commission entry approval (Phase 2 slice 1). Pure logic so it is unit-testable
 * in the node/vitest harness; the PATCH boundary and the approval console reuse
 * it. The server boundary remains the source of truth for authorization.
 */

export type CommissionApprover = {
  role: PortalRole;
  countries: readonly string[];
  reseller?: string;
};

const ALLOWED_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  Pending: ["Approved", "Cancelled"],
  Approved: ["Paid", "Cancelled"],
  Paid: [],
  Cancelled: [],
};

/** Returns an error for an invalid status transition, or null when allowed. */
export function validateCommissionStatusTransition(
  from: CommissionStatus,
  to: CommissionStatus,
): string | null {
  if (from === to) {
    return `Commission is already "${from}".`;
  }
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    return `Cannot move a commission from "${from}" to "${to}".`;
  }
  return null;
}

/**
 * Whether the acting user may change this entry's status.
 *  - Super Admin: any entry
 *  - Regional Director: entries in one of their countries
 *  - Reseller Admin: entries for their own reseller
 *  - Sales Team User: none
 */
export function canApproveCommission(
  approver: CommissionApprover,
  entry: { country: string; reseller: string },
): boolean {
  switch (approver.role) {
    case "Super Admin":
      return true;
    case "Regional Director":
      return approver.countries.includes(entry.country);
    case "Reseller Admin":
      return Boolean(approver.reseller) && approver.reseller === entry.reseller;
    default:
      return false;
  }
}

/**
 * Full validation for an approval action: authorization first, then transition.
 * Returns { ok } or { error, status } where status is the HTTP code to use.
 */
export function evaluateCommissionApproval(
  approver: CommissionApprover,
  entry: { country: string; reseller: string; status: CommissionStatus },
  nextStatus: CommissionStatus,
): { ok: true } | { ok: false; error: string; status: 400 | 403 } {
  if (!canApproveCommission(approver, entry)) {
    return { ok: false, error: "You are not allowed to update this commission.", status: 403 };
  }
  const transitionError = validateCommissionStatusTransition(entry.status, nextStatus);
  if (transitionError) {
    return { ok: false, error: transitionError, status: 400 };
  }
  return { ok: true };
}
