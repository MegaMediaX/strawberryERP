import "server-only";

import { ROLE_RANK } from "@/lib/business/team-member-create";
import { getUsers } from "@/lib/dev-store";
import type { PortalUser } from "@/lib/portal-security";

/**
 * Lead assignment authority (spec §9).
 *
 * When adding a lead, the "Assigned user" field must be a dropdown of exactly
 * the people the acting user has authority over — never free text. "Authority
 * over" means, uniformly: active users who rank STRICTLY BELOW the acting user
 * and fall within the acting user's data scope, plus the acting user themselves.
 * Scope is derived from the same role hierarchy the rest of the platform uses:
 *
 *   - Super Admin        → every active user (top rank; all others are below)
 *   - Regional Director  → lower-ranked users operating in the director's countries
 *   - Reseller Admin     → lower-ranked users in their own reseller (their sales team)
 *   - Sales Team User    → only themselves (nobody ranks below them)
 *
 * The acting user is always included, even when the session identity is not in
 * the portal store (e.g. a header-simulated dev session), so a user can always
 * assign a lead to themselves.
 */
export function assignableUsersFor(actingUser: PortalUser): PortalUser[] {
  const actingRank = ROLE_RANK[actingUser.role];

  const subordinates = getUsers().filter(
    (u) => u.active && u.id !== actingUser.id && ROLE_RANK[u.role] < actingRank && inScope(actingUser, u),
  );

  // Self always comes first so single-authority roles (Sales) surface their own
  // name, and higher roles get an obvious "assign to me" default.
  return [actingUser, ...subordinates];
}

/** Whether `target` falls inside `actingUser`'s data scope for assignment. */
function inScope(actingUser: PortalUser, target: PortalUser): boolean {
  switch (actingUser.role) {
    case "Super Admin":
      return true;
    case "Regional Director":
      return target.countries.some((c) => actingUser.countries.includes(c));
    case "Reseller Admin":
      return !!actingUser.reseller && target.reseller === actingUser.reseller;
    case "Sales Team User":
    default:
      return false;
  }
}

/**
 * Server-side guard mirroring the add-lead dropdown: is `assigneeName` a user
 * the acting user is allowed to assign a lead to?
 *
 * Empty assignees pass here (the required-field validation rejects them). An
 * assignee unknown to the portal store is allowed through so live Frappe users
 * — which never live in the dev-store — are not falsely rejected; the backend
 * remains the source of truth for those. Assignees that ARE known are held to
 * the acting user's authority scope.
 */
export function canAssignLeadTo(actingUser: PortalUser, assigneeName: string | null | undefined): boolean {
  const name = (assigneeName ?? "").trim();
  if (!name) return true;
  if (name === actingUser.name) return true;

  const known = getUsers().some((u) => u.name === name);
  if (!known) return true;

  return assignableUsersFor(actingUser).some((u) => u.name === name);
}
