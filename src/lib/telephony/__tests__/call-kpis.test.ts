import { describe, expect, it } from "vitest";

import { agentCallKpis, agentOf, applyAcquiredInfo, filterByWindow, scopeCallRecords, teamCallKpis } from "@/lib/telephony/call-kpis";
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
    // Only the 120s call is "over one minute"; a 60s talk is NOT (> 60, strict).
    expect(rami.callsOverOneMinute).toBe(1);
    // most-calls-first ordering
    expect(kpis[0].agent).toBe("rami");
  });

  it("does NOT derive infoAcquired from call records (it is lead-level, filled by applyAcquiredInfo)", () => {
    const recs = [
      call({ agent: "m", acquiredPhone: "03999000" }),
      call({ agent: "m", acquiredEmail: "new@lead.com" }),
    ];
    const [m] = agentCallKpis(recs);
    expect(m.infoAcquired).toBe(0);
  });

  it("counts only answered calls with talk time strictly over 60s (1m+ calls)", () => {
    const recs = [
      call({ agent: "z", answered: true, talkSeconds: 61 }), // counts
      call({ agent: "z", answered: true, talkSeconds: 60 }), // boundary — excluded
      call({ agent: "z", answered: true, talkSeconds: 600 }), // counts
      // A long "talk" on an unanswered/short-call record must never count.
      call({ agent: "z", answered: false, outcome: "rang_no_answer", talkSeconds: 999 }),
    ];
    const [z] = agentCallKpis(recs);
    expect(z.callsOverOneMinute).toBe(2);
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

describe("scopeCallRecords", () => {
  const recs = [
    call({ agent: "rami@x", assignedTo: "rami@x", reseller: "Beirut Digital", country: "Lebanon" }),
    call({ agent: "sara@x", assignedTo: "sara@x", reseller: "Beirut Digital", country: "Lebanon" }),
    call({ agent: "omar@x", assignedTo: "omar@x", reseller: "MedTech CY", country: "Cyprus" }),
    call({ agent: undefined, assignedTo: undefined, reseller: undefined, country: undefined, linkState: "unlinked" }),
  ];

  it("Super Admin sees all", () => {
    expect(scopeCallRecords(recs, { role: "Super Admin" })).toHaveLength(4);
  });

  it("Reseller Admin sees only their reseller", () => {
    const out = scopeCallRecords(recs, { role: "Reseller Admin", reseller: "Beirut Digital" });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.reseller === "Beirut Digital")).toBe(true);
  });

  it("Regional Director sees only their countries", () => {
    const out = scopeCallRecords(recs, { role: "Regional Director", countries: ["Cyprus"] });
    expect(out).toHaveLength(1);
    expect(out[0].country).toBe("Cyprus");
  });

  it("Sales sees only their own calls", () => {
    const out = scopeCallRecords(recs, { role: "Sales Team User", name: "rami@x", email: "rami@lebtech.example" });
    expect(out).toHaveLength(1);
    expect(agentOf(out[0])).toBe("rami@x");
  });

  it("an unknown role sees nothing (fail-closed)", () => {
    expect(scopeCallRecords(recs, { role: "Mystery" })).toHaveLength(0);
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
    expect(t.callsOverOneMinute).toBe(0); // the one answered call was exactly 60s
  });

  it("is safe with zero calls", () => {
    expect(teamCallKpis([])).toMatchObject({ activeAgents: 0, callsMade: 0, answerRatePct: 0, avgTalkSeconds: 0 });
  });
});

describe("applyAcquiredInfo (lead-level infoAcquired)", () => {
  it("fills per-agent infoAcquired onto existing call rows and updates the team total", () => {
    const agents = agentCallKpis([call({ agent: "rami" }), call({ agent: "sara" })]);
    const team = teamCallKpis([call({ agent: "rami" }), call({ agent: "sara" })]);
    const { agents: out, team: t } = applyAcquiredInfo(agents, team, [
      { agent: "rami" },
      { agent: "rami" },
      { agent: "sara" },
    ]);
    expect(out.find((a) => a.agent === "rami")!.infoAcquired).toBe(2);
    expect(out.find((a) => a.agent === "sara")!.infoAcquired).toBe(1);
    expect(t.infoAcquired).toBe(3);
  });

  it("adds a row for an agent who captured info but made no calls (union — visible with zero calls)", () => {
    const { agents: out, team: t } = applyAcquiredInfo([], teamCallKpis([]), [{ agent: "omar" }]);
    const omar = out.find((a) => a.agent === "omar")!;
    expect(omar.infoAcquired).toBe(1);
    expect(omar.callsMade).toBe(0); // no calls, still shown
    expect(t.infoAcquired).toBe(1);
    expect(t.callsMade).toBe(0);
  });

  it("respects the date window when acquisitions carry a timestamp", () => {
    const { team: t } = applyAcquiredInfo([], teamCallKpis([]), [
      { agent: "a", acquiredAt: "2026-07-01T09:00:00Z" },
      { agent: "a", acquiredAt: "2026-07-09T09:00:00Z" },
      { agent: "a" }, // undated → always counted
    ], { from: "2026-07-05T00:00:00Z" });
    expect(t.infoAcquired).toBe(2); // the 07-09 one + the undated one; 07-01 excluded
  });
});
