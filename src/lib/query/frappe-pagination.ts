/**
 * Maps portal pagination params (page / pageSize / sort) to the Frappe REST
 * convention (limit_start / limit_page_length / order_by), so the same opt-in
 * pagination the dev-store path honours is forwarded to the ERPNext backend.
 *
 * Pure + host-testable. The whitelisted Frappe methods must accept these query
 * params (bench-fire concern); this helper only builds them.
 */

const MAX_PAGE_SIZE = 200;

export interface FrappePaginationParams {
  limit_start?: number;
  limit_page_length?: number;
  order_by?: string;
}

export function frappePaginationParams(input: {
  page?: number | string | null;
  pageSize?: number | string | null;
  sortBy?: string | null;
  sortDir?: string | null;
}): FrappePaginationParams {
  const pageNum = Number(input.page);
  const sizeNum = Number(input.pageSize);

  const hasPage = input.page != null && input.page !== "" && Number.isFinite(pageNum);
  const hasSize = input.pageSize != null && input.pageSize !== "" && Number.isFinite(sizeNum);

  if (!hasPage && !hasSize) {
    return {};
  }

  const pageSize = Math.min(MAX_PAGE_SIZE, hasSize && sizeNum > 0 ? Math.floor(sizeNum) : 50);
  const page = hasPage && pageNum > 0 ? Math.floor(pageNum) : 1;

  const params: FrappePaginationParams = {
    limit_start: (page - 1) * pageSize,
    limit_page_length: pageSize,
  };

  if (input.sortBy) {
    const dir = input.sortDir === "desc" ? "desc" : "asc";
    params.order_by = `${input.sortBy} ${dir}`;
  }

  return params;
}
