import type { PortalRole, PortalUser } from "@/lib/portal-security";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Lead transfer / reassignment scoping (Phase 1 / B1 slice 4). Pure logic so it
 * is unit-testable in the node/vitest harness; the modal user-picker and any
 * server check reuse it. Reassignment changes ONLY the assigned user — it never
 * moves a lead across reseller/country boundaries.
 *
 * Rules:
 * - Sales Team User cannot reassign (returns no candidates).
 * - A candidate must be active and cover the lead's country.
 * - If the lead is reseller-scoped, a candidate that belongs to a reseller must
 *   belong to the SAME reseller (no cross-reseller handoff). Candidates with no
 *   reseller (Regional Director / Super Admin oversight) are allowed.
 * - The acting user's own scope further narrows the pool:
 *     Super Admin       → any (subject to the lead rules above)
 *     Regional Director → candidates whose countries intersect the director's
 *     Reseller Admin    → candidates in the acting admin's reseller
 */

const CAN_REASSIGN: Record<PortalRole, boolean> = {
  "Super Admin": true,
  "Regional Director": true,
  "Reseller Admin": true,
  "Sales Team User": false,
};

function coversCountry(user: PortalUser, country: string): boolean {
  return (user.countries as readonly string[]).includes(country);
}

function matchesLeadReseller(user: PortalUser, lead: PortalLead): boolean {
  if (!lead.reseller) return true;
  // Users without a reseller (directors/super admin) may oversee any reseller.
  if (!user.reseller) return true;
  return user.reseller === lead.reseller;
}

function withinActingScope(candidate: PortalUser, actingUser: PortalUser): boolean {
  switch (actingUser.role) {
    case "Super Admin":
      return true;
    case "Regional Director":
      return candidate.countries.some((c) => (actingUser.countries as readonly string[]).includes(c));
    case "Reseller Admin":
      return Boolean(actingUser.reseller) && candidate.reseller === actingUser.reseller;
    default:
      return false;
  }
}

/** Active users the acting user may assign this lead to, under all scoping rules. */
export function eligibleAssignees(
  lead: PortalLead,
  actingUser: PortalUser,
  users: readonly PortalUser[],
): PortalUser[] {
  if (!CAN_REASSIGN[actingUser.role]) return [];
  return users.filter(
    (user) =>
      user.active &&
      coversCountry(user, lead.country) &&
      matchesLeadReseller(user, lead) &&
      withinActingScope(user, actingUser),
  );
}

/** Returns a human-readable error for an invalid reassignment, or null when valid. */
export function validateReassignment(
  lead: PortalLead,
  targetUserId: string,
  actingUser: PortalUser,
  users: readonly PortalUser[],
): string | null {
  if (!CAN_REASSIGN[actingUser.role]) {
    return "Your role cannot reassign leads.";
  }
  if (!targetUserId) {
    return "Select a user to assign this lead to.";
  }
  const eligible = eligibleAssignees(lead, actingUser, users);
  if (!eligible.some((user) => user.id === targetUserId)) {
    return "Selected user is not eligible for this lead's country/reseller scope.";
  }
  return null;
}
