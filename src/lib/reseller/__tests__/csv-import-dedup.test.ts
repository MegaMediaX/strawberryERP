import { describe, expect, it } from "vitest";

import { dedupKey, validateRecords } from "@/lib/reseller/csv-import";
import type { NewLeadInput } from "@/lib/business/new-lead";

/**
 * dedupKey (src/lib/reseller/csv-import.ts) phone-normalization behavior.
 * csv-import.test.ts only exercises byte-identical phone strings; this file
 * proves punctuation/whitespace invariance (the actual normalization the
 * function performs — strip every non-digit char) and, separately, pins the
 * CURRENT (non-)behavior for a "00" international-prefix vs "+" variant of
 * the same number, which does NOT collapse to a single key today. That is a
 * documented gap, not a claim of correct behavior — a future fix that adds
 * true international-prefix normalization should update this pinning
 * assertion rather than being surprised by it.
 */
describe("dedupKey — punctuation/whitespace invariance (within a file and against existingKeys)", () => {
  it("collapses the same number written with different spacing/dashes/parens to one key", () => {
    const variants = [
      "+961 70 123 456",
      "+961-70-123-456",
      "961 70 123 456",
      "961 (70) 123-456",
      "+961   70   123   456",
    ];
    const keys = variants.map((phone) => dedupKey("Acme Trading", phone));
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("acmetrading|96170123456");
  });

  it("company-name normalization is case/punctuation-insensitive too", () => {
    expect(dedupKey("Acme Trading", "+961701234")).toBe(dedupKey("ACME-TRADING!!", "+961701234"));
    expect(dedupKey("Acme Trading", "+961701234")).toBe(dedupKey("acme trading", "+961701234"));
  });

  it("validateRecords flags an in-file duplicate across differently-punctuated phone variants of the same number", () => {
    const records: NewLeadInput[] = [
      {
        companyName: "Acme Trading", country: "Lebanon", assignedUser: "Marven El Mouallem",
        contactFirstName: "", contactLastName: "", gender: "", phone: "+961 70 123 456", email: "",
      },
      {
        companyName: "Acme Trading", country: "Lebanon", assignedUser: "Marven El Mouallem",
        contactFirstName: "", contactLastName: "", gender: "", phone: "961-70-123-456", email: "",
      },
    ];
    const results = validateRecords(records, {
      countries: ["Lebanon"],
      assignees: ["Marven El Mouallem"],
    });
    expect(results[0].duplicate).toBe(false);
    expect(results[1].duplicate).toBe(true);
  });

  it("validateRecords dedups against existingKeys using a differently-punctuated variant of a stored phone", () => {
    const records: NewLeadInput[] = [
      {
        companyName: "Acme Trading", country: "Lebanon", assignedUser: "Marven El Mouallem",
        contactFirstName: "", contactLastName: "", gender: "", phone: "961 (70) 123-456", email: "",
      },
    ];
    const results = validateRecords(records, {
      countries: ["Lebanon"],
      assignees: ["Marven El Mouallem"],
      // Seeded from a lead already on file, stored with + and spaces.
      existingKeys: [dedupKey("Acme Trading", "+961 70 123 456")],
    });
    expect(results[0].duplicate).toBe(true);
  });
});

describe("dedupKey — documented gap: international-prefix (00 vs +) variants do NOT collapse today", () => {
  it("a '00'-prefixed number and its '+'-prefixed equivalent produce DIFFERENT keys (pinned current behavior)", () => {
    const plusKey = dedupKey("Acme Trading", "+961 70 123 456");
    const zeroZeroKey = dedupKey("Acme Trading", "0096170123456");
    // dedupKey only strips non-digit characters — it does not recognize "00"
    // as an international-dialing equivalent of "+". A reseller CSV mixing
    // both conventions for the same underlying number will silently import
    // it twice. This assertion documents the gap; a fix should normalize
    // leading "00" to "+" (or strip both) before diffing this test.
    expect(plusKey).not.toBe(zeroZeroKey);
    expect(plusKey).toBe("acmetrading|96170123456");
    expect(zeroZeroKey).toBe("acmetrading|0096170123456");
  });
});
