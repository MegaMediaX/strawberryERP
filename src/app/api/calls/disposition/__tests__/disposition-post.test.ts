import { describe, expect, it } from "vitest";

import { DELETE, POST } from "@/app/api/calls/disposition/route";
import { getCallRecords, getLeadOverrides, upsertCallRecord } from "@/lib/dev-store";
import { leads } from "@/lib/sample-data";
import type { CallRecord } from "@/lib/telephony/call-record";

function seedCall(externalId: string, leadId: string): CallRecord {
  const record: CallRecord = {
    externalId,
    direction: "outbound",
    fromNumber: "1001",
    toNumber: "03123456",
    contactNumber: "03123456",
    outcome: "answered",
    answered: true,
    ringSeconds: 4,
    talkSeconds: 90,
    durationSeconds: 94,
    startedAt: "2026-07-02T09:00:00.000Z",
    recordingFile: null,
    account: "1001@x",
    extension: "1001",
    linkState: "linked",
    leadId,
    agent: "USR-SUPER",
    loggedAt: "2026-07-02T09:01:00.000Z",
  };
  upsertCallRecord(record);
  return record;
}

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

describe("POST /api/calls/disposition — acquired information (lead-level)", () => {
  it("stores acquired info on the lead (attributed to the agent) and stamps the linked call too", async () => {
    const leadId = leads[3].id;
    const externalId = `acq-${leadId}`;
    seedCall(externalId, leadId);

    const res = await post({
      leadId,
      disposition: "Awaiting response",
      externalId,
      acquiredPhone: "03 999 000",
      acquiredEmail: "New@Lead.com",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).acquiredInfoSaved).toBe(true);

    // Lead-level: always saved, attributed to the acting agent.
    const ov = getLeadOverrides()[leadId]!;
    expect(ov.acquiredPhone).toBe("03999000");
    expect(ov.acquiredEmail).toBe("new@lead.com"); // lowercased
    expect(ov.acquiredBy).toBeTruthy();
    expect(ov.acquiredAt).toBeTruthy();

    // Bonus: the linked call is stamped for live-mode fidelity.
    const callRec = getCallRecords().find((c) => c.externalId === externalId)!;
    expect(callRec.acquiredPhone).toBe("03999000");
    expect(callRec.acquiredEmail).toBe("new@lead.com");
  });

  it("still saves (lead-level) with NO externalId — no silent drop", async () => {
    const leadId = leads[1].id;
    const res = await post({ leadId, disposition: "Awaiting response", acquiredEmail: "orphan@lead.com" });
    expect(res.status).toBe(200);
    expect((await res.json()).acquiredInfoSaved).toBe(true);
    expect(getLeadOverrides()[leadId]?.acquiredEmail).toBe("orphan@lead.com");
  });

  it("ownership guard: a stale externalId pointing at another lead's call does NOT stamp that call", async () => {
    const otherLead = leads[2].id;
    const otherCall = `acq-other-${otherLead}`;
    seedCall(otherCall, otherLead); // belongs to leads[2]

    // Disposition on leads[0] but passing leads[2]'s call id.
    const res = await post({ leadId: leads[0].id, disposition: "Awaiting response", externalId: otherCall, acquiredPhone: "03 555 000" });
    expect(res.status).toBe(200);
    expect((await res.json()).acquiredInfoSaved).toBe(true); // lead-level still saved on leads[0]
    // The other lead's call is untouched.
    expect(getCallRecords().find((c) => c.externalId === otherCall)!.acquiredPhone).toBeUndefined();
    expect(getLeadOverrides()[leads[0].id]?.acquiredPhone).toBe("03555000");
  });
});

describe("POST /api/calls/disposition — no-DELETE boundary", () => {
  it("DELETE returns 405", () => {
    expect(DELETE().status).toBe(405);
  });
});
