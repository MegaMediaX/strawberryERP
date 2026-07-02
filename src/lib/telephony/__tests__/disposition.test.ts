import { describe, expect, it } from "vitest";

import { parseDispositionInput, resolveDisposition } from "@/lib/telephony/disposition";

describe("parseDispositionInput", () => {
  it("accepts a valid disposition", () => {
    const r = parseDispositionInput({ leadId: "LEAD-1", disposition: "Interested", notes: "keen" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ leadId: "LEAD-1", disposition: "Interested", notes: "keen" });
  });

  it("rejects a missing leadId", () => {
    expect(parseDispositionInput({ disposition: "Interested" }).ok).toBe(false);
  });

  it("rejects an unknown disposition", () => {
    expect(parseDispositionInput({ leadId: "LEAD-1", disposition: "Vibes" }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseDispositionInput(null).ok).toBe(false);
  });
});

describe("resolveDisposition", () => {
  const input = (over = {}) => ({ leadId: "LEAD-1", disposition: "No answer" as const, ...over });

  it("maps 'No answer' → Attempted Contact (valid from a New Lead)", () => {
    const r = resolveDisposition(input(), "New Lead (Uncontacted)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.targetStatus).toBe("Attempted Contact (No Response)");
  });

  it("rejects 'Interested' directly from a New Lead (invalid transition)", () => {
    const r = resolveDisposition({ leadId: "LEAD-1", disposition: "Interested" }, "New Lead (Uncontacted)");
    expect(r.ok).toBe(false);
  });

  it("maps 'Interested' → Contacted (Interested) from a progress state", () => {
    const r = resolveDisposition({ leadId: "LEAD-1", disposition: "Interested" }, "Contacted (Awaiting Response)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.targetStatus).toBe("Contacted (Interested)");
  });

  it("requires a follow-up date for 'Callback scheduled'", () => {
    const noDate = resolveDisposition({ leadId: "LEAD-1", disposition: "Callback scheduled" }, "Contacted (Interested)");
    expect(noDate.ok).toBe(false);

    const withDate = resolveDisposition(
      { leadId: "LEAD-1", disposition: "Callback scheduled", followUpDate: "2026-07-10" },
      "Contacted (Interested)",
    );
    expect(withDate.ok).toBe(true);
    if (!withDate.ok) return;
    expect(withDate.value).toMatchObject({ targetStatus: "Scheduled Follow-Up", followUp: "2026-07-10" });
  });
});
