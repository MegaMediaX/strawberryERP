import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/leads/import/route";
import type { ImportRecord } from "@/lib/reseller/csv-import";

function req(body: unknown): Request {
  return new Request("http://localhost/api/frappe/leads/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const rec = (over: Partial<ImportRecord>): ImportRecord => ({
  rowNumber: 1,
  data: { companyName: "A", country: "Lebanon", assignedUser: "Marven El Mouallem", contactFirstName: "X", contactLastName: "Y", gender: "Male", phone: "+961 70 1", email: "a@a.co" },
  errors: [],
  duplicate: false,
  ...over,
});

describe("POST /api/frappe/leads/import (dev-store stub)", () => {
  it("returns a simulated summary for valid records + policy", async () => {
    const res = await POST(req({ duplicatePolicy: "skip", records: [rec({}), rec({ duplicate: true }), rec({ errors: ["Invalid email"] })] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.simulated).toBe(true);
    expect(json.data.summary).toEqual({ imported: 1, skipped: 2, duplicates: 1 });
  });

  it("rejects an unknown duplicate policy", async () => {
    const res = await POST(req({ duplicatePolicy: "nuke", records: [rec({})] }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty record set", async () => {
    const res = await POST(req({ duplicatePolicy: "skip", records: [] }));
    expect(res.status).toBe(400);
  });
});
