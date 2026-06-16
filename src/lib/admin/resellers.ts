import type { Reseller } from "@/lib/business/reseller-defaults";

/**
 * Super Admin reseller management helpers (spec §10/§12). Pure + unit-testable.
 * The list/detail compose existing tested pieces (Reseller record, validateReseller,
 * regionalResellers metrics); these add the display labels + the Login-As target
 * resolution + reason validation that the impersonation flow needs.
 */

export interface UserLike { id: string; name: string; role: string; reseller?: string; active: boolean }

/** "12% on Fully Paid" — the §10 Commission Rule column. */
export function resellerCommissionLabel(r: Pick<Reseller, "defaultCommissionPercentage" | "defaultCommissionTrigger">): string {
  return `${r.defaultCommissionPercentage}% on ${r.defaultCommissionTrigger}`;
}

/** Branding mode label (branding config ships in the White-Label slice). */
export function brandingModeLabel(): string {
  return "Global";
}

/** Resolve the Reseller Admin user to impersonate for a reseller (§12). */
export function resolveResellerAdmin(users: readonly UserLike[], resellerName: string): UserLike | null {
  return users.find((u) => u.active && u.role === "Reseller Admin" && u.reseller === resellerName) ?? null;
}

/** §12 Login-As requires a confirmation reason. Returns an error or null. */
export function validateLoginAsReason(reason: string | undefined): string | null {
  const r = (reason ?? "").trim();
  if (!r) return "A reason is required to start impersonation.";
  if (r.length > 200) return "Reason must be 200 characters or fewer.";
  return null;
}
