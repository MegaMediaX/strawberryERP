import type { PortalSession } from "@/lib/portal-security";

/**
 * Scope parameters to forward to the Frappe `list_leads` method so the live
 * ERPNext query is filtered by the caller's role — mirrors the dev-store
 * `filterByPermission` isolation (CLAUDE_HANDOFF §4 / §9). Without this, the
 * Frappe-backed leads endpoint would return ALL leads to every role.
 */
export function leadsScopeForFrappe(session: PortalSession): Record<string, string> {
  const user = session.effectiveUser;
  if (user.role === "Super Admin") return {};

  const scope: Record<string, string> = {};
  if (user.role === "Regional Director") {
    if (user.countries.length) scope.countries = user.countries.join(",");
  } else if (user.role === "Reseller Admin") {
    if (user.reseller) scope.reseller = user.reseller;
    if (user.countries.length === 1) scope.country = user.countries[0];
  } else if (user.role === "Sales Team User") {
    scope.assigned_user = user.name;
  }
  return scope;
}
