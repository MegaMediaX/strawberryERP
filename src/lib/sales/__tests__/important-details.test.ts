import { describe, expect, it } from "vitest";

import { importantDetailsFor } from "@/lib/sales/important-details";

describe("importantDetailsFor (spec §8)", () => {
  it("returns the per-reseller set when one exists", () => {
    const bdp = importantDetailsFor("Beirut Digital Partners");
    expect(bdp.some((l) => /early-bird/i.test(l))).toBe(true);
    expect(bdp.length).toBeGreaterThan(0);
  });

  it("falls back to the global set for an unknown reseller", () => {
    const unknown = importantDetailsFor("Some Other Reseller");
    expect(unknown.some((l) => /partners, not sponsors/i.test(l))).toBe(true);
  });

  it("always includes the no-discount guardrail", () => {
    for (const reseller of ["Beirut Digital Partners", "MedTech Channel CY", "Unknown"]) {
      expect(importantDetailsFor(reseller).some((l) => /discount/i.test(l))).toBe(true);
    }
  });
});
