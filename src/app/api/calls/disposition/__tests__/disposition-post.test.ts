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

describe("POST /api/calls/disposition — acquired information", () => {
  it("attaches a captured phone/email to the linked call and reports it saved", async () => {
    const leadId = leads[3].id;
    const externalId = `acq-${leadId}`;
    seedCall(externalId, leadId);

    const res = await post({
      leadId,
      disposition: "Awaiting response",
      externalId,
      acquiredPhone: "03 999 000",
      acquiredEmail: "new@lead.com",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.acquiredInfoSaved).toBe(true);

    const call = getCallRecords().find((c) => c.externalId === externalId)!;
    expect(call.acquiredPhone).toBe("03999000");
    expect(call.acquiredEmail).toBe("new@lead.com");
  });

  it("reports not-saved when no externalId links the disposition to a logged call", async () => {
    const res = await post({ leadId: leads[0].id, disposition: "Awaiting response", acquiredEmail: "orphan@lead.com" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.acquiredInfoSaved).toBe(false);
  });
});

describe("POST /api/calls/disposition — no-DELETE boundary", () => {
  it("DELETE returns 405", () => {
    expect(DELETE().status).toBe(405);
  });
});
