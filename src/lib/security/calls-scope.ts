import type { PortalSession } from "@/lib/portal-security";

/**
 * Scope parameters to forward to the Frappe `list_calls` method so the live
 * call-record query is filtered by the caller's role — mirrors scopeCallRecords
 * (src/lib/telephony/call-kpis.ts) and leadsScopeForFrappe (leads-scope.ts).
 * Without this, the Frappe-backed calls endpoint would return ALL calls to
 * every role.
 */
export function callsScopeForFrappe(session: PortalSession): Record<string, string> {
  const user = session.effectiveUser;
  if (user.role === "Super Admin") return {};

  const scope: Record<string, string> = {};
  if (user.role === "Regional Director") {
    if (user.countries.length) scope.countries = user.countries.join(",");
  } else if (user.role === "Reseller Admin") {
    if (user.reseller) scope.reseller = user.reseller;
  } else if (user.role === "Sales Team User") {
    // list_calls matches this identity against BOTH the `agent` and
    // `assigned_to` fields server-side (build_identity_or_filters) — mirrors
    // the agentOf() fallback chain in call-kpis.ts.
    scope.agent = user.name;
  }
  return scope;
}
