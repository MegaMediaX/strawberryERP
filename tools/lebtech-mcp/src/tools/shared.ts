import { z } from "zod";

/** Pagination params shared by the portal list endpoints (pagination is mandatory app-side). */
export const paginationShape = {
  page: z.number().int().min(1).optional().describe("Page number (default 1)"),
  pageSize: z.number().int().min(1).max(200).optional().describe("Rows per page (default 50)"),
  sortBy: z.string().optional().describe("Field to sort by"),
  sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
};

export function paginationQuery(args: Record<string, unknown>): Record<string, string | number | undefined> {
  return {
    page: args.page as number | undefined,
    pageSize: args.pageSize as number | undefined,
    sortBy: args.sortBy as string | undefined,
    sortDir: args.sortDir as string | undefined,
  };
}

/** Free-form record payload for endpoints whose full field list lives app-side. */
export const recordPayload = z.record(z.unknown());
