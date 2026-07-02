import { describe, expect, it } from "vitest";

import { DELETE, POST } from "@/app/api/calls/disposition/route";
import { getLeadOverrides } from "@/lib/dev-store";
import { leads } from "@/lib/sample-data";

/**
 * Contract tests for POST /api/calls/disposition (ADR 0001, Phase 2). Runs as a
 * Super Admin session (sees all leads) so scope doesn't obscure the wiring.
 */

function post(body: unknown, userId = "USR-SUPER") {
  return POST(
    new Request("https://portal.local/api/calls/disposition", {
      method: "POST",
      headers: { "content-type": "application/json", "x-platform-user-id": userId },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/calls/disposition — validation", () => {
  it("rejects an unknown disposition with 400", async () => {
    const res = await post({ leadId: leads[0].id, disposition: "Vibes" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a lead that does not exist", async () => {
    const res = await post({ leadId: "LEAD-DOES-NOT-EXIST", disposition: "No answer" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/calls/disposition — applies status + follow-up", () => {
  it("captures 'No answer' → Attempted Contact and persists the override", async () => {
    const leadId = leads[0].id;
    const res = await post({ leadId, disposition: "No answer", notes: "left voicemail" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("Attempted Contact (No Response)");
    expect(getLeadOverrides()[leadId]?.status).toBe("Attempted Contact (No Response)");
  });

  it("captures a scheduled callback with a follow-up date", async () => {
    const leadId = leads[1].id;
    // Move to a progress state first (valid from any status), then schedule.
    await post({ leadId, disposition: "Awaiting response" });
    const res = await post({ leadId, disposition: "Callback scheduled", followUpDate: "2026-07-10" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("Scheduled Follow-Up");
    expect(json.followUp).toBe("2026-07-10");
    expect(getLeadOverrides()[leadId]?.followUp).toBe("2026-07-10");
  });

  it("rejects 'Callback scheduled' without a follow-up date (400)", async () => {
    const leadId = leads[2].id;
    await post({ leadId, disposition: "Awaiting response" });
    const res = await post({ leadId, disposition: "Callback scheduled" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/calls/disposition — no-DELETE boundary", () => {
  it("DELETE returns 405", () => {
    expect(DELETE().status).toBe(405);
  });
});
