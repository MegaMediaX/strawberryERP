import { describe, expect, it } from "vitest";

import {
  entryMatchesLead,
  GLOBAL_IMPORTANT_DETAILS,
  resolveImportantDetails,
  validateImportantDetailEntry,
  type ImportantDetailEntry,
} from "@/lib/business/important-details-mgmt";
import type { PortalLead } from "@/lib/ui-data";

const lead = { reseller: "Beirut Digital Partners", country: "Lebanon", source: "WhatsApp", priority: "VIP" } as PortalLead;

const entry = (over: Partial<ImportantDetailEntry>): ImportantDetailEntry => ({
  id: "e", reseller: "Beirut Digital Partners", title: "T", body: ["Line A"],
  applyTo: { scope: "all" }, updatedAt: "2026-06-01T00:00:00Z", ...over,
});

describe("validateImportantDetailEntry (§14)", () => {
  it("requires title, at least one line, and a value for scoped rules", () => {
    expect(validateImportantDetailEntry({ title: "", body: ["x"], applyTo: { scope: "all" } })).toMatch(/Title/);
    expect(validateImportantDetailEntry({ title: "T", body: ["", "  "], applyTo: { scope: "all" } })).toMatch(/at least one/);
    expect(validateImportantDetailEntry({ title: "T", body: ["x"], applyTo: { scope: "country" } })).toMatch(/country/);
    expect(validateImportantDetailEntry({ title: "T", body: ["x"], applyTo: { scope: "country", value: "Lebanon" } })).toBeNull();
  });
});

describe("entryMatchesLead (§14)", () => {
  it("matches by scope", () => {
    expect(entryMatchesLead(entry({ applyTo: { scope: "all" } }), lead)).toBe(true);
    expect(entryMatchesLead(entry({ applyTo: { scope: "country", value: "Lebanon" } }), lead)).toBe(true);
    expect(entryMatchesLead(entry({ applyTo: { scope: "country", value: "Cyprus" } }), lead)).toBe(false);
    expect(entryMatchesLead(entry({ applyTo: { scope: "source", value: "WhatsApp" } }), lead)).toBe(true);
    expect(entryMatchesLead(entry({ applyTo: { scope: "priority", value: "VIP" } }), lead)).toBe(true);
  });
});

describe("resolveImportantDetails (§14)", () => {
  it("returns matching reseller entries' lines, de-duplicated", () => {
    const out = resolveImportantDetails(lead, [
      entry({ id: "1", body: ["Line A", "Line B"] }),
      entry({ id: "2", applyTo: { scope: "priority", value: "VIP" }, body: ["Line B", "Line C"] }),
      entry({ id: "3", reseller: "Other", body: ["Leak"] }),
      entry({ id: "4", applyTo: { scope: "country", value: "Cyprus" }, body: ["No match"] }),
    ]);
    expect(out).toEqual(["Line A", "Line B", "Line C"]);
  });

  it("falls back to the global set when no entries match", () => {
    expect(resolveImportantDetails(lead, [])).toEqual(GLOBAL_IMPORTANT_DETAILS);
    expect(resolveImportantDetails(lead, [entry({ reseller: "Other" })])).toEqual(GLOBAL_IMPORTANT_DETAILS);
  });
});
