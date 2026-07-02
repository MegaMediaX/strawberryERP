import { describe, expect, it } from "vitest";

import { agentCallKpis, agentOf, filterByWindow, teamCallKpis } from "@/lib/telephony/call-kpis";
import type { CallRecord } from "@/lib/telephony/call-record";

function call(over: Partial<CallRecord> = {}): CallRecord {
  return {
    externalId: `c-${Math.random().toString(36).slice(2)}`,
    direction: "outbound",
    fromNumber: "1001",
    toNumber: "03123456",
    contactNumber: "03123456",
    outcome: "answered",
    answered: true,
    ringSeconds: 4,
    talkSeconds: 60,
    durationSeconds: 64,
    startedAt: "2026-07-02T09:00:00.000Z",
    recordingFile: null,
    account: "1001@x",
    extension: "1001",
    linkState: "linked",
    agent: "rami@x",
    loggedAt: "2026-07-02T09:01:00.000Z",
    ...over,
  };
}

describe("agentOf", () => {
  it("prefers agent, falls back to assignedTo, then Unassigned", () => {
    expect(agentOf(call({ agent: "a", assignedTo: "b" }))).toBe("a");
    expect(agentOf(call({ agent: undefined, assignedTo: "b" }))).toBe("b");
    expect(agentOf(call({ agent: undefined, assignedTo: undefined }))).toBe("Unassigned");
  });
});

describe("filterByWindow", () => {
  const recs = [
    call({ startedAt: "2026-07-01T10:00:00.000Z" }),
    call({ startedAt: "2026-07-05T10:00:00.000Z" }),
  ];
  it("filters inclusive by from/to", () => {
    expect(filterByWindow(recs, { from: "2026-07-02T00:00:00.000Z" })).toHaveLength(1);
    expect(filterByWindow(recs, { to: "2026-07-02T00:00:00.000Z" })).toHaveLength(1);
    expect(filterByWindow(recs, {})).toHaveLength(2);
  });
});

describe("agentCallKpis", () => {
  it("computes per-agent answer rate, talk time, and per-day", () => {
    const recs = [
      call({ agent: "rami", answered: true, outcome: "answered", talkSeconds: 60, startedAt: "2026-07-01T09:00:00Z" }),
      call({ agent: "rami", answered: true, outcome: "answered", talkSeconds: 120, startedAt: "2026-07-01T10:00:00Z" }),
      call({ agent: "rami", answered: false, outcome: "rang_no_answer", talkSeconds: 0, startedAt: "2026-07-02T09:00:00Z" }),
      call({ agent: "sara", answered: true, outcome: "answered", talkSeconds: 30, startedAt: "2026-07-01T09:00:00Z" }),
    ];
    const kpis = agentCallKpis(recs);
    const rami = kpis.find((k) => k.agent === "rami")!;
    expect(rami.callsMade).toBe(3);
    expect(rami.answered).toBe(2);
    expect(rami.unanswered).toBe(1);
    expect(rami.answerRatePct).toBe(67); // 2/3
    expect(rami.totalTalkSeconds).toBe(180);
    expect(rami.avgTalkSeconds).toBe(90); // over answered only
    expect(rami.longestTalkSeconds).toBe(120);
    expect(rami.shortestTalkSeconds).toBe(60);
    expect(rami.callsPerDay).toBe(1.5); // 3 calls / 2 distinct days
    // most-calls-first ordering
    expect(kpis[0].agent).toBe("rami");
  });

  it("handles all-unanswered (avg/longest talk = 0)", () => {
    const recs = [
      call({ agent: "x", answered: false, outcome: "rang_no_answer", talkSeconds: 0 }),
      call({ agent: "x", answered: false, outcome: "rang_no_answer", talkSeconds: 0 }),
    ];
    const [x] = agentCallKpis(recs);
    expect(x.answered).toBe(0);
    expect(x.answerRatePct).toBe(0);
    expect(x.avgTalkSeconds).toBe(0);
    expect(x.longestTalkSeconds).toBe(0);
  });

  it("buckets unlinked calls and counts them", () => {
    const recs = [call({ agent: undefined, assignedTo: undefined, linkState: "unlinked" })];
    const [u] = agentCallKpis(recs);
    expect(u.agent).toBe("Unassigned");
    expect(u.unlinkedCount).toBe(1);
  });

  it("returns [] for no calls", () => {
    expect(agentCallKpis([])).toEqual([]);
  });
});

describe("teamCallKpis", () => {
  it("rolls up totals and distinct active agents", () => {
    const recs = [
      call({ agent: "rami", answered: true, talkSeconds: 60 }),
      call({ agent: "sara", answered: false, outcome: "rang_no_answer", talkSeconds: 0 }),
    ];
    const t = teamCallKpis(recs);
    expect(t.activeAgents).toBe(2);
    expect(t.callsMade).toBe(2);
    expect(t.answered).toBe(1);
    expect(t.answerRatePct).toBe(50);
    expect(t.totalTalkSeconds).toBe(60);
  });

  it("is safe with zero calls", () => {
    expect(teamCallKpis([])).toMatchObject({ activeAgents: 0, callsMade: 0, answerRatePct: 0, avgTalkSeconds: 0 });
  });
});
