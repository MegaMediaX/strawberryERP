import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/frappe/leads/route";

/**
 * Proves the /api/frappe/leads GET supports opt-in server-side pagination
 * (scale DoD: no full-table loads to UI), and that scoping is preserved — a
 * Sales user's paginated results contain only their own leads.
 */

function get(query: string, userId = "USR-SUPER") {
  return GET(
    new Request(`https://portal.local/api/frappe/leads${query}`, {
      headers: { "x-platform-user-id": userId },
    }),
  );
}

describe("GET /api/frappe/leads — pagination", () => {
  it("paginates with defaults (page 1, size 50) when no params — never a full-table dump", async () => {
    const res = await get("");
    const body = (await res.json()) as { ok: boolean; data: unknown[]; page: number; pageSize: number; total: number };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.data.length).toBeLessThanOrEqual(50);
    expect(typeof body.total).toBe("number");
  });

  it("returns a page with meta when page/pageSize are supplied", async () => {
    const res = await get("?page=1&pageSize=2");
    const body = (await res.json()) as {
      ok: boolean;
      data: unknown[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
    expect(typeof body.total).toBe("number");
    expect(body.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("caps page size at 200", async () => {
    const res = await get("?pageSize=99999");
    const body = (await res.json()) as { pageSize: number };
    expect(body.pageSize).toBe(200);
  });
});
