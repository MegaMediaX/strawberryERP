import { describe, expect, it } from "vitest";

import { frappePaginationParams } from "@/lib/query/frappe-pagination";

/**
 * Portal pagination -> Frappe REST (limit_start / limit_page_length / order_by).
 */

describe("frappePaginationParams", () => {
  it("returns no params when neither page nor pageSize is given", () => {
    expect(frappePaginationParams({})).toEqual({});
    expect(frappePaginationParams({ page: "", pageSize: null })).toEqual({});
  });

  it("computes limit_start from a 1-based page", () => {
    expect(frappePaginationParams({ page: 1, pageSize: 50 })).toMatchObject({
      limit_start: 0,
      limit_page_length: 50,
    });
    expect(frappePaginationParams({ page: 3, pageSize: 25 })).toMatchObject({
      limit_start: 50,
      limit_page_length: 25,
    });
  });

  it("accepts string params (as they arrive from query strings)", () => {
    expect(frappePaginationParams({ page: "2", pageSize: "10" })).toMatchObject({
      limit_start: 10,
      limit_page_length: 10,
    });
  });

  it("caps the page length at 200", () => {
    expect(frappePaginationParams({ pageSize: 99999 }).limit_page_length).toBe(200);
  });

  it("defaults page size to 50 and page to 1 for invalid values", () => {
    const p = frappePaginationParams({ page: 0, pageSize: -5 });
    expect(p).toMatchObject({ limit_start: 0, limit_page_length: 50 });
  });

  it("builds order_by from sort fields", () => {
    expect(frappePaginationParams({ pageSize: 10, sortBy: "creation", sortDir: "desc" }).order_by).toBe(
      "creation desc",
    );
    expect(frappePaginationParams({ pageSize: 10, sortBy: "company_name" }).order_by).toBe("company_name asc");
  });

  it("omits order_by when no sort field is given", () => {
    expect(frappePaginationParams({ pageSize: 10 }).order_by).toBeUndefined();
  });
});
