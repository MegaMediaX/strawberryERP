import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/frappe/[...resource]/route";

/**
 * Generic /api/frappe/* boundary: opt-in server-side pagination on list
 * collections (invoices/receipts/customers/resellers/commissions/contracts).
 * Scale DoD — no full-table loads to the UI.
 */

function get(resource: string[], query = "", userId = "USR-SUPER") {
  const path = resource.join("/");
  return GET(
    new Request(`https://portal.local/api/frappe/${path}${query}`, {
      headers: { "x-platform-user-id": userId },
    }),
    { params: Promise.resolve({ resource }) },
  );
}

describe("boundary GET pagination", () => {
  it("returns full array for invoices with no params (backward compatible)", async () => {
    const res = await get(["invoices"]);
    const body = (await res.json()) as { ok: boolean; data: unknown[]; total?: number };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeUndefined();
  });

  it("paginates invoices with page/pageSize and reports meta", async () => {
    const res = await get(["invoices"], "?page=1&pageSize=1");
    const body = (await res.json()) as {
      ok: boolean;
      data: unknown[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(1);
    expect(typeof body.total).toBe("number");
  });

  it("paginates customers and caps page size at 200", async () => {
    const res = await get(["customers"], "?pageSize=99999");
    const body = (await res.json()) as { pageSize: number };
    expect(body.pageSize).toBe(200);
  });
});
