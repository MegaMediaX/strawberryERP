import type { DeleteQueueRecord } from "@/lib/portal-security";

/**
 * Super Admin Delete Queue (spec §32). Pure + unit-testable. Permanent deletion
 * is HIGH-RISK: "Clear All" requires a TYPED confirmation phrase. The actual
 * mutations live in the dev-store (`resolveDeleteQueue` / `clearDeleteQueue`);
 * this module owns the guard + filtering used by the route and the view.
 */

/** The exact phrase the admin must type to confirm a Clear-All. */
export const CLEAR_ALL_CONFIRM = "CLEAR ALL";

export function isClearAllConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === CLEAR_ALL_CONFIRM;
}

export type DeleteQueueAction = "restore" | "permanent";

export interface DeleteQueueFilters {
  entityType?: string;
  reseller?: string;
  country?: string;
  status?: DeleteQueueRecord["status"];
}

export function filterDeleteQueue(records: readonly DeleteQueueRecord[], f: DeleteQueueFilters): DeleteQueueRecord[] {
  return records.filter((r) => {
    if (f.entityType && r.entityType !== f.entityType) return false;
    if (f.reseller && r.reseller !== f.reseller) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.status && r.status !== f.status) return false;
    return true;
  });
}

export function pendingDeleteCount(records: readonly DeleteQueueRecord[]): number {
  return records.filter((r) => r.status === "Pending").length;
}

export function deleteStatusTone(status: DeleteQueueRecord["status"]): "amber" | "green" | "rose" | "neutral" {
  if (status === "Pending") return "amber";
  if (status === "Restored") return "green";
  if (status === "Permanently Deleted") return "rose";
  return "neutral";
}
