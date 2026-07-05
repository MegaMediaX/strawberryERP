import { describe, expect, it } from "vitest";

import { PATCH } from "@/app/api/frappe/leads/route";
import { leads } from "@/lib/sample-data";

/**
 * Route-level proof that the lead status-transition guard (§3) is actually
 * enforced at the /api/frappe/leads PATCH boundary — not just unit-tested in
 * isolation. Runs in dev-store mode (Frappe not configured).
 */

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("https://portal.local/api/frappe/leads", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
      body: JSON.stringify(body),
    }),
  );
}

const scheduled = leads.find((l) => l.status === "Scheduled Follow-Up")!;

describe("PATCH /api/frappe/leads — transition enforcement", () => {
  it("rejects an invalid transition with 400", async () => {
    const res = await patch({ id: scheduled.id, status: "New Lead (Uncontacted)" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toMatch(/Cannot move a lead/);
  });

  it("accepts a valid transition", async () => {
    const res = await patch({ id: scheduled.id, status: "Contacted (Interested)" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("still requires a lead id", async () => {
    const res = await patch({ status: "Contacted (Interested)" });
    expect(res.status).toBe(400);
  });

  it("rejects clearing the follow-up date on a Scheduled Follow-Up lead (date-only PATCH)", async () => {
    // Auto-save sends followUpDate-only patches; without a status change the
    // transition guard must still refuse to leave a scheduled lead date-less.
    const res = await patch({ id: scheduled.id, followUpDate: "" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/required for Scheduled Follow-Up/i);
  });
});
