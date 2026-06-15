import { describe, expect, it } from "vitest";

import { COUNTRY_ALL, resolveRegionalCountries, scopeByCountry } from "@/lib/regional/regional-scope";

const assigned = ["Lebanon", "Jordan"];

describe("resolveRegionalCountries (spec §6)", () => {
  it("returns all assigned by default / on 'all'", () => {
    expect(resolveRegionalCountries(assigned)).toEqual(["Lebanon", "Jordan"]);
    expect(resolveRegionalCountries(assigned, COUNTRY_ALL)).toEqual(["Lebanon", "Jordan"]);
  });
  it("narrows to a single assigned country", () => {
    expect(resolveRegionalCountries(assigned, "Jordan")).toEqual(["Jordan"]);
  });
  it("ignores a selection outside the assigned set (never widens)", () => {
    expect(resolveRegionalCountries(assigned, "Cyprus")).toEqual(["Lebanon", "Jordan"]);
  });
  it("is empty for an unassigned director", () => {
    expect(resolveRegionalCountries([])).toEqual([]);
  });
});

describe("scopeByCountry (spec §2)", () => {
  it("keeps only rows within the effective country list", () => {
    const rows = [{ country: "Lebanon" }, { country: "Cyprus" }, { country: "Jordan" }];
    expect(scopeByCountry(rows, ["Lebanon", "Jordan"]).map((r) => r.country)).toEqual(["Lebanon", "Jordan"]);
  });
});
