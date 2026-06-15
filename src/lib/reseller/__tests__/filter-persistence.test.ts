import { describe, expect, it } from "vitest";

import { deserializeLeadFilters, serializeLeadFilters } from "@/lib/reseller/filter-persistence";

describe("reseller leads filter persistence (spec §30)", () => {
  it("serializes only non-empty known fields", () => {
    const json = serializeLeadFilters({ search: "cedar", country: "", status: "Contacted (Interested)", assignedUser: "Rami K." });
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({ search: "cedar", status: "Contacted (Interested)", assignedUser: "Rami K." });
    expect("country" in parsed).toBe(false);
  });

  it("round-trips through serialize → deserialize", () => {
    const filters = { search: "abc", country: "Lebanon", priority: "VIP", source: "WhatsApp" };
    expect(deserializeLeadFilters(serializeLeadFilters(filters))).toEqual(filters);
  });

  it("is defensive against malformed JSON and unknown keys", () => {
    expect(deserializeLeadFilters("not json")).toEqual({});
    expect(deserializeLeadFilters(JSON.stringify({ evil: "x", search: "ok" }))).toEqual({ search: "ok" });
  });
});
