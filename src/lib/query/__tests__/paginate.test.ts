import { describe, expect, it } from "vitest";

import { paginate } from "@/lib/query/scoped-page";

const rows = Array.from({ length: 125 }, (_, i) => ({
  id: `R-${i + 1}`,
  status: i % 2 === 0 ? "open" : "closed",
  rank: i,
}));

describe("paginate", () => {
  it("returns the requested page and reports totals", () => {
    const p = paginate(rows, { page: 2, pageSize: 50 });
    expect(p.rows).toHaveLength(50);
    expect(p.total).toBe(125);
    expect(p.totalPages).toBe(3);
    expect(p.rows[0].id).toBe("R-51");
  });

  it("applies exact-match filters before paging", () => {
    const p = paginate(rows, { page: 1, pageSize: 200, filters: { status: "open" } });
    expect(p.total).toBe(63);
    expect(p.rows.every((r) => r.status === "open")).toBe(true);
  });

  it("sorts ascending and descending", () => {
    const asc = paginate(rows, { pageSize: 1, sortBy: "rank", sortDir: "asc" });
    const desc = paginate(rows, { pageSize: 1, sortBy: "rank", sortDir: "desc" });
    expect(asc.rows[0].rank).toBe(0);
    expect(desc.rows[0].rank).toBe(124);
  });

  it("caps page size at 200 and ignores empty filters", () => {
    const p = paginate(rows, { pageSize: 99999, filters: { status: "" } });
    expect(p.pageSize).toBe(200);
    expect(p.total).toBe(125);
  });

  it("returns an empty page past the end", () => {
    expect(paginate(rows, { page: 99, pageSize: 50 }).rows).toHaveLength(0);
  });
});
