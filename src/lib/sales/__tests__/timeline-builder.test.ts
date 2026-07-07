import { describe, expect, it } from "vitest";

import { buildTimeline, callTimelineEntries, type CallTimelineInput } from "@/lib/sales/timeline-builder";
import type { PortalLead } from "@/lib/ui-data";

const answeredCall: CallTimelineInput = {
  direction: "inbound",
  outcome: "answered",
  answered: true,
  talkSeconds: 42,
  ringSeconds: 5,
  startedAt: "2026-07-02T09:15:03.000Z",
};
const missedCall: CallTimelineInput = {
  direction: "outbound",
  outcome: "rang_no_answer",
  answered: false,
  talkSeconds: 0,
  ringSeconds: 23,
  startedAt: "2026-07-03T09:15:03.000Z",
};

function lead(over: Partial<PortalLead> = {}): PortalLead {
  return {
    id: "LEAD-9", company: "Acme", contact: "Sara", gender: "Female", country: "Lebanon",
    reseller: "Beirut Digital Partners", assignedTo: "Marven El Mouallem", phone: "+961", email: "s@x",
    priority: "High", status: "Contacted (Interested)", followUp: "Tomorrow, 10:00",
    source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

describe("buildTimeline (spec §12)", () => {
  it("orders status first and lead-created last", () => {
    const t = buildTimeline(lead());
    expect(t[0]).toMatchObject({ icon: "status", detail: "Contacted (Interested)" });
    expect(t[t.length - 1]).toMatchObject({ icon: "plus", label: "Lead created", detail: "LEAD-9" });
  });

  it("includes a follow-up entry only when a follow-up is set", () => {
    expect(buildTimeline(lead({ followUp: "Tomorrow" })).some((e) => e.icon === "calendar")).toBe(true);
    expect(buildTimeline(lead({ followUp: "" })).some((e) => e.icon === "calendar")).toBe(false);
  });

  it("always includes assignment, source, and created entries", () => {
    const icons = buildTimeline(lead()).map((e) => e.icon);
    expect(icons).toEqual(expect.arrayContaining(["status", "user", "inbox", "plus"]));
  });

  it("prepends logged calls, most-recent-first, showing talk/ring time", () => {
    const t = buildTimeline(lead(), [answeredCall, missedCall]);
    // missedCall (Jul 3) is more recent than answeredCall (Jul 2) → comes first.
    expect(t[0]).toMatchObject({ label: "Outbound call — no answer", detail: "rang 23s · 2026-07-03" });
    expect(t[1]).toMatchObject({ label: "Inbound call — answered", detail: "talk 42s · 2026-07-02" });
    // Lead-derived entries still follow.
    expect(t[2]).toMatchObject({ icon: "status" });
  });

  it("is backward compatible: no calls arg → no call entries", () => {
    const t = buildTimeline(lead());
    expect(t[0]).toMatchObject({ icon: "status" });
  });
});

describe("callTimelineEntries", () => {
  it("returns [] for no calls", () => {
    expect(callTimelineEntries([])).toEqual([]);
  });

  it("shows talk time for answered, ring time for no-answer", () => {
    const [a] = callTimelineEntries([answeredCall]);
    expect(a.detail).toContain("talk 42s");
    const [m] = callTimelineEntries([missedCall]);
    expect(m.detail).toContain("rang 23s");
  });
});
