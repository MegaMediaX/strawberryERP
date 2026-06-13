/**
 * Scoped server-side pagination primitive.
 *
 * Mirrors the Frappe `permission_query_conditions` isolation (country / reseller /
 * assigned-user) and enforces it BEFORE pagination, so a scoped user can never
 * page into records outside their scope — the correctness invariant that must
 * hold at the 10k-lead / 5k-customer scale target (CLAUDE_HANDOFF §4 / §9).
 *
 * Every list endpoint should route through `scopedPage` rather than loading a
 * full table into the UI.
 */

export type ScopeRole =
  | "Super Admin"
  | "Regional Director"
  | "Reseller Admin"
  | "Sales Team User";

export interface ScopeContext {
  role: ScopeRole;
  countries: string[];
  reseller?: string;
  userName?: string;
}

export interface ScopedRecord {
  country?: string;
  reseller?: string;
  assignedUser?: string;
  [key: string]: unknown;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** Exact-match filters applied after scope (e.g. { status: "New Lead" }). */
  filters?: Record<string, string>;
}

export interface Page<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

/** Does a single record fall inside the caller's scope? */
export function inScope(record: ScopedRecord, scope: ScopeContext): boolean {
  switch (scope.role) {
    case "Super Admin":
      return true;
    case "Regional Director":
      return !!record.country && scope.countries.includes(record.country);
    case "Reseller Admin":
      return !!record.reseller && record.reseller === scope.reseller;
    case "Sales Team User":
      return !!record.assignedUser && record.assignedUser === scope.userName;
    default:
      return false;
  }
}

function clampPageSize(size: number | undefined): number {
  if (!size || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(size), MAX_PAGE_SIZE);
}

/**
 * Apply filters → sort → page to an already-scoped (or unscoped) record set.
 * Pure and synchronous so it is trivially testable and benchmarkable.
 */
export function paginate<T>(records: readonly T[], query: PageQuery = {}): Page<T> {
  const pageSize = clampPageSize(query.pageSize);
  const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;

  let rowsAll = records as readonly T[];

  if (query.filters) {
    const entries = Object.entries(query.filters).filter(([, value]) => value !== undefined && value !== "");
    if (entries.length) {
      rowsAll = rowsAll.filter((record) =>
        entries.every(([key, value]) => String((record as Record<string, unknown>)[key] ?? "") === value),
      );
    }
  }

  if (query.sortBy) {
    const dir = query.sortDir === "desc" ? -1 : 1;
    const key = query.sortBy;
    rowsAll = [...rowsAll].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av === bv) return 0;
      return (av! < bv! ? -1 : 1) * dir;
    });
  }

  const total = rowsAll.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const rows = rowsAll.slice(start, start + pageSize);

  return { rows, page, pageSize, total, totalPages };
}

/**
 * Apply scope → filters → sort → page. Returns one page plus the scoped total.
 * Scope is enforced BEFORE pagination so a scoped user can never page into
 * out-of-scope records.
 */
export function scopedPage<T extends ScopedRecord>(
  records: readonly T[],
  scope: ScopeContext,
  query: PageQuery = {},
): Page<T> {
  const scoped = records.filter((record) => inScope(record, scope));
  return paginate(scoped, query);
}
