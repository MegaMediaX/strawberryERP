import { describe, expect, it } from "vitest";

import { buildLeadOutcomePatch, type LeadOutcome } from "@/lib/business/lead-outcome";

const base: LeadOutcome = {
  status: "Contacted (Interested)",
  followUpDate: "2026-07-10",
  notes: "Keen on annual plan.",
};

describe("buildLeadOutcomePatch", () => {
  it("returns null when nothing changed", () => {
    expect(buildLeadOutcomePatch("LEAD-1", base, { ...base })).toBeNull();
  });

  it("returns null when only whitespace differs (trimmed compare)", () => {
    expect(buildLeadOutcomePatch("LEAD-1", base, { ...base, notes: "  Keen on annual plan.  " })).toBeNull();
  });

  it("carries only the changed status", () => {
    expect(buildLeadOutcomePatch("LEAD-1", base, { ...base, status: "Scheduled Follow-Up" })).toEqual({
      id: "LEAD-1",
      status: "Scheduled Follow-Up",
    });
  });

  it("carries only the changed follow-up date", () => {
    expect(buildLeadOutcomePatch("LEAD-1", base, { ...base, followUpDate: "2026-08-01" })).toEqual({
      id: "LEAD-1",
      followUpDate: "2026-08-01",
    });
  });

  it("sends trimmed notes when they change", () => {
    expect(buildLeadOutcomePatch("LEAD-1", base, { ...base, notes: "  New note  " })).toEqual({
      id: "LEAD-1",
      notes: "New note",
    });
  });

  it("carries every changed field together", () => {
    const patch = buildLeadOutcomePatch("LEAD-1", base, {
      status: "Scheduled Follow-Up",
      followUpDate: "2026-08-01",
      notes: "Call back Monday",
    });
    expect(patch).toEqual({
      id: "LEAD-1",
      status: "Scheduled Follow-Up",
      followUpDate: "2026-08-01",
      notes: "Call back Monday",
    });
  });
});
