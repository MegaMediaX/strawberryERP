import type { ActivityTimelineEvent } from "@/lib/phase2-data";

/**
 * Super Admin Audit Log derivation + search (spec §33). Pure + unit-testable.
 * Maps the dev-store activity timeline into displayable, searchable rows and
 * provides CSV export. Read-only: this module never mutates the timeline.
 */

export interface AuditLogRow {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  module: string;
  record: string;
  details: string;
}

/** Derive a display role from the `performedBy` audit label ("X as Role" / "X impersonating Y"). */
export function deriveRole(performedBy: string): string {
  if (/impersonating/i.test(performedBy)) return "Impersonation";
  const m = performedBy.match(/ as (.+)$/);
  return m ? m[1] : "—";
}

export function toAuditRows(events: readonly ActivityTimelineEvent[]): AuditLogRow[] {
  return events.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    user: e.performedBy.replace(/ as .+$/, ""),
    role: deriveRole(e.performedBy),
    action: e.action,
    module: e.entityType,
    record: e.entityId,
    details: e.oldValue || e.newValue ? `${e.oldValue || "∅"} → ${e.newValue || "∅"}` : "",
  }));
}

export interface AuditLogFilters {
  query?: string;
  module?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function filterAuditRows(rows: readonly AuditLogRow[], f: AuditLogFilters): AuditLogRow[] {
  const q = f.query?.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.module && r.module !== f.module) return false;
    if (f.action && r.action !== f.action) return false;
    if (f.dateFrom && r.timestamp < f.dateFrom) return false;
    if (f.dateTo && r.timestamp > `${f.dateTo}T23:59:59Z`) return false;
    if (q) {
      const hay = `${r.user} ${r.role} ${r.action} ${r.module} ${r.record} ${r.details}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function auditModules(rows: readonly AuditLogRow[]): string[] {
  return [...new Set(rows.map((r) => r.module))].sort();
}

export function auditActions(rows: readonly AuditLogRow[]): string[] {
  return [...new Set(rows.map((r) => r.action))].sort();
}

const csvCell = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

/** §33 export — CSV string of the (already-filtered) rows. */
export function auditRowsToCsv(rows: readonly AuditLogRow[]): string {
  const header = ["Timestamp", "User", "Role", "Action", "Module", "Record", "Details"];
  const lines = rows.map((r) => [r.timestamp, r.user, r.role, r.action, r.module, r.record, r.details].map(csvCell).join(","));
  return [header.map(csvCell).join(","), ...lines].join("\n");
}
