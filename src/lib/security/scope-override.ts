import type { PortalSession } from "@/lib/portal-security";

/**
 * P1-4 (defense-in-depth): resources whose payload carries a `reseller`
 * scope field. Mirrors the resource list already used for GET's
 * scopePayloadForFrappe in the [...resource] route.
 */
const RESELLER_SCOPED_RESOURCES = new Set([
  "invoices",
  "receipts",
  "customers",
  "leads",
  "commissions/rules",
  "commissions/entries",
]);

/**
 * Builds the outgoing payload for a write (POST/PATCH) proxied to Frappe,
 * with the scope fields (`country` / `reseller`) OVERRIDDEN by the
 * session-derived scope for any non-Super-Admin caller — never merged, and
 * never left as the raw client-supplied value. This closes the gap where a
 * scoped caller could otherwise smuggle a write into another country's or
 * reseller's data by simply setting those fields in the request body.
 *
 * Super Admin is unrestricted and passes the payload through unchanged.
 */
export function scopePayloadForOutgoingWrite(
  resource: string,
  session: Pick<PortalSession, "effectiveUser">,
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base = payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : {};
  const user = session.effectiveUser;

  if (user.role === "Super Admin") {
    return base;
  }

  if (user.countries.length === 1) {
    base.country = user.countries[0];
  }

  if (user.reseller && RESELLER_SCOPED_RESOURCES.has(resource)) {
    base.reseller = user.reseller;
  }

  if (user.role === "Sales Team User" && resource === "leads") {
    base.assigned_user = user.name;
  }

  return base;
}
