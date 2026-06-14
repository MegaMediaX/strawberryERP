import { describe, expect, it } from "vitest";

import { quickOutcomeDef, quickOutcomes, quickOutcomeStatus } from "@/lib/business/quick-outcomes";

describe("quick outcomes (spec §10)", () => {
  it("exposes all six outcomes", () => {
    expect(quickOutcomes.map((o) => o.outcome)).toEqual([
      "NoAnswer", "Interested", "NotInterested", "CallLater", "WrongNumber", "Converted",
    ]);
  });

  it("maps status outcomes to the correct LeadStatus", () => {
    expect(quickOutcomeStatus("NoAnswer")).toBe("Attempted Contact (No Response)");
    expect(quickOutcomeStatus("Interested")).toBe("Contacted (Interested)");
    expect(quickOutcomeStatus("NotInterested")).toBe("Contacted (Not Interested)");
    expect(quickOutcomeStatus("CallLater")).toBe("Scheduled Follow-Up");
  });

  it("returns null status for convert and flag outcomes", () => {
    expect(quickOutcomeStatus("Converted")).toBeNull();
    expect(quickOutcomeStatus("WrongNumber")).toBeNull();
  });

  it("classifies each outcome by kind", () => {
    expect(quickOutcomeDef("CallLater").kind).toBe("schedule");
    expect(quickOutcomeDef("Converted").kind).toBe("convert");
    expect(quickOutcomeDef("WrongNumber").kind).toBe("flag");
    expect(quickOutcomeDef("Interested").kind).toBe("status");
  });
});
