import { describe, expect, it } from "vitest";

import { validateCountry } from "@/lib/phase2-data";
import { allowedCountries } from "@/lib/sample-data";

/**
 * Country-block invariant — CLAUDE_HANDOFF.md §3 / §9 / §18:
 * Israel / IL / ISR / "occupied palestine" must never be accepted, and only the
 * enabled allowlist (Lebanon, Cyprus, Jordan, Syria) is permitted.
 */

describe("§9/§18 — blocked countries are always rejected", () => {
  const blocked = [
    "Israel",
    "IL",
    "ISR",
    "Occupied Palestine",
    "occupied palestine",
    "israel",
  ];

  for (const country of blocked) {
    it(`rejects "${country}"`, () => {
      expect(validateCountry(country)).not.toBeNull();
    });
  }

  it("rejects anything outside the enabled allowlist (fail-closed)", () => {
    expect(validateCountry("Narnia")).not.toBeNull();
    expect(validateCountry("United States")).not.toBeNull();
  });

  it("requires a country", () => {
    expect(validateCountry(undefined)).toBe("Country is required.");
    expect(validateCountry("")).toBe("Country is required.");
  });
});

describe("§3 — enabled countries are accepted", () => {
  for (const country of allowedCountries) {
    it(`accepts "${country}"`, () => {
      expect(validateCountry(country)).toBeNull();
    });
  }

  it("the allowlist contains exactly the four enabled countries and excludes Israel", () => {
    expect([...allowedCountries].sort()).toEqual(["Cyprus", "Jordan", "Lebanon", "Syria"]);
    expect((allowedCountries as readonly string[])).not.toContain("Israel");
  });
});
