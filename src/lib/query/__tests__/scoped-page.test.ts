import { describe, expect, it } from "vitest";

import { generateDataset } from "@/lib/dev/synthetic";
import { scopedPage, type ScopeContext } from "@/lib/query/scoped-page";

/**
 * Scoping-under-pagination correctness at scale (CLAUDE_HANDOFF §4 / §9).
 * A scoped user must NEVER page into records outside their scope, no matter the
 * page number or page size, at the full 10k/5k volume.
 */

const { leads } = generateDataset({ leads: 10_000, customers: 5_000, seed: 7 });

describe("scopedPage — Super Admin sees everything, paginated", () => {
  const scope: ScopeContext = { role: "Super Admin", countries: [] };

  it("total equals full dataset and pages partition cleanly", () => {
    const first = scopedPage(leads, scope, { page: 1, pageSize: 50 });
    expect(first.total).toBe(10_000);
    expect(first.totalPages).toBe(200);
    expect(first.rows).toHaveLength(50);

    const last = scopedPage(leads, scope, { page: 200, pageSize: 50 });
    expect(last.rows).toHaveLength(50);
    const overflow = scopedPage(leads, scope, { page: 201, pageSize: 50 });
    expect(overflow.rows).toHaveLength(0);
  });

  it("caps page size at 200 to prevent full-table loads", () => {
    const page = scopedPage(leads, scope, { page: 1, pageSize: 100_000 });
    expect(page.pageSize).toBe(200);
    expect(page.rows.length).toBeLessThanOrEqual(200);
  });
});

describe("scopedPage — Sales user only ever sees assigned records, on every page", () => {
  const sampleUser = leads[1234].assignedUser;
  const scope: ScopeContext = { role: "Sales Team User", countries: [], userName: sampleUser };
  const expectedTotal = leads.filter((l) => l.assignedUser === sampleUser).length;

  it("scoped total matches the assigned count", () => {
    const page = scopedPage(leads, scope, { page: 1, pageSize: 50 });
    expect(page.total).toBe(expectedTotal);
    expect(expectedTotal).toBeGreaterThan(0);
  });

  it("no row on any page leaks an unassigned record", () => {
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(expectedTotal / pageSize));
    const seen = new Set<string>();
    for (let p = 1; p <= totalPages; p++) {
      const page = scopedPage(leads, scope, { page: p, pageSize });
      for (const row of page.rows) {
        expect(row.assignedUser).toBe(sampleUser);
        seen.add(row.id);
      }
    }
    expect(seen.size).toBe(expectedTotal);
  });
});

describe("scopedPage — Regional Director limited to assigned countries", () => {
  const scope: ScopeContext = { role: "Regional Director", countries: ["Lebanon", "Jordan"] };

  it("never returns a record outside the country scope", () => {
    const page = scopedPage(leads, scope, { page: 1, pageSize: 200 });
    for (const row of page.rows) {
      expect(["Lebanon", "Jordan"]).toContain(row.country);
    }
    const expected = leads.filter((l) => ["Lebanon", "Jordan"].includes(l.country!)).length;
    expect(page.total).toBe(expected);
  });
});

describe("scopedPage — Reseller Admin limited to own reseller", () => {
  const reseller = leads[42].reseller;
  const scope: ScopeContext = { role: "Reseller Admin", countries: [], reseller };

  it("scope + filter compose without leaking", () => {
    const page = scopedPage(leads, scope, { page: 1, pageSize: 200, filters: { priority: "VIP" } });
    for (const row of page.rows) {
      expect(row.reseller).toBe(reseller);
      expect(row.priority).toBe("VIP");
    }
  });
});
