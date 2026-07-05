import { describe, expect, it } from "vitest";

import { parseImportResponse } from "./import-response";

const okSummary = { imported: 3, skipped: 1, duplicates: 2 };

describe("parseImportResponse", () => {
  it("returns the summary from a well-formed dev-store response", () => {
    const r = parseImportResponse({ ok: true, data: { source: "dev-store", simulated: true, summary: okSummary } });
    expect(r).toEqual({ ok: true, summary: okSummary });
  });

  it("fails closed (no summary) on a malformed 200 body missing data", () => {
    const r = parseImportResponse({ ok: true });
    expect(r.ok).toBe(false);
    expect(r.summary).toBeNull();
  });

  it("fails closed when data.summary is absent", () => {
    const r = parseImportResponse({ ok: true, data: { simulated: true } });
    expect(r).toEqual({ ok: false, summary: null, error: "Import response was malformed." });
  });

  it("does NOT headline success when the summary is missing (guards fail-open)", () => {
    // A body that parsed to {} (the .catch fallback) must never advance to a
    // '{imported} Imported' screen with an undefined/garbage summary.
    const r = parseImportResponse({});
    expect(r.ok).toBe(false);
    expect(r.summary).toBeNull();
  });

  it("rejects a summary whose counts are not finite numbers", () => {
    const r = parseImportResponse({ ok: true, data: { summary: { imported: "3", skipped: 1, duplicates: 2 } } });
    expect(r.ok).toBe(false);
  });

  it("surfaces a server error message when the response is not ok", () => {
    const r = parseImportResponse({ ok: false, error: "No records to import." });
    expect(r).toEqual({ ok: false, summary: null, error: "No records to import." });
  });

  it("tolerates null / non-object input without throwing", () => {
    expect(parseImportResponse(null).ok).toBe(false);
    expect(parseImportResponse(undefined).ok).toBe(false);
    expect(parseImportResponse("nope").ok).toBe(false);
  });
});
