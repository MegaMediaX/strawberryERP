import { describe, expect, it } from "vitest";

import { validateImportCsv } from "@/lib/phase2-data";
import { leads } from "@/lib/sample-data";

/**
 * Lead CSV import validation — CLAUDE_HANDOFF.md §3 / §9:
 * the import path must enforce the country block, required columns, gender
 * (Male/Female), and duplicate detection (company / phone / email).
 */

const HEADER = "company,country,contact,gender,phone,email";

function csv(...dataRows: string[]) {
  return [HEADER, ...dataRows].join("\n");
}

describe("validateImportCsv", () => {
  it("requires a header and at least one data row", () => {
    const result = validateImportCsv("company,country");
    expect(result.accepted).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/header row and at least one data row/);
  });

  it("flags missing required columns", () => {
    const result = validateImportCsv("company,country\nAcme,Lebanon");
    expect(result.warnings.join(" ")).toMatch(/Missing required column/);
  });

  it("accepts a valid, unique, enabled-country row", () => {
    const result = validateImportCsv(
      csv("Zenith Unique Co,Lebanon,Sara N,Female,+961 00 999 888,unique-zenith@example.test"),
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].company).toBe("Zenith Unique Co");
  });

  it("rejects a blocked-country row on the import path", () => {
    const result = validateImportCsv(csv("Blocked Co,Israel,Ann B,Female,+972 1 222 333,blocked@example.test"));
    expect(result.accepted).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/Country is not enabled/);
  });

  it("rejects an invalid gender", () => {
    const result = validateImportCsv(csv("Gender Co,Lebanon,Pat X,Other,+961 00 111 222,gender@example.test"));
    expect(result.accepted).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/gender must be Male or Female/);
  });

  it("detects a duplicate against an existing lead (by email)", () => {
    const existing = leads[0];
    const result = validateImportCsv(
      csv(`Brand New Name,Lebanon,Dup Contact,Male,+961 00 333 444,${existing.email}`),
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/possible duplicate/);
  });
});
