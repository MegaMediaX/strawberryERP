import { describe, expect, it } from "vitest";

import { simulateDialResult, validateDialRequest } from "@/lib/telephony/dial";

describe("validateDialRequest", () => {
  it("accepts a valid number and normalizes it", () => {
    const r = validateDialRequest({ number: "03 123 456", leadId: "LEAD-1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.number).toBe("03123456");
    expect(r.value.leadId).toBe("LEAD-1");
  });

  it("rejects a missing number with 400", () => {
    const r = validateDialRequest({});
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a country-blocked (IL/ISR) number with 403", () => {
    const r = validateDialRequest({ number: "+972 50 123 4567" });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a non-object body", () => {
    expect(validateDialRequest(null).ok).toBe(false);
  });
});

describe("simulateDialResult", () => {
  it("returns a simulated status with an honest reason (live dialing off, not a trunk fault)", () => {
    const r = simulateDialResult();
    expect(r.status).toBe("simulated");
    expect(r.note).toMatch(/TELEPHONY_LIVE_DIAL/);
    expect(r.note).toMatch(/no call was placed/i);
    // Must NOT blame the PBX trunk — it is provisioned and verified.
    expect(r.note).not.toMatch(/trunk not/i);
  });
});
