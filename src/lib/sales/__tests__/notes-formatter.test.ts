import { describe, expect, it } from "vitest";

import { formatNoteLine, noteTemplates, parseNotes, prependNote } from "@/lib/sales/notes-formatter";

describe("notes formatter (spec §11)", () => {
  it("formats a line with timestamp + author + trimmed text", () => {
    expect(formatNoteLine("  called, no answer  ", "Marven El Mouallem", "2026-06-14T10:00:00Z")).toBe(
      "2026-06-14T10:00:00Z · Marven El Mouallem: called, no answer",
    );
  });

  it("prepends so the latest note is first", () => {
    const a = prependNote("", "L1");
    const b = prependNote(a, "L2");
    expect(b).toBe("L2\nL1");
  });

  it("parses notes into latest-first lines, dropping blanks", () => {
    expect(parseNotes("L2\n\n L1 \n")).toEqual(["L2", "L1"]);
    expect(parseNotes("")).toEqual([]);
  });

  it("exposes the five quick templates", () => {
    expect(noteTemplates).toContain("Asked to call tomorrow");
    expect(noteTemplates).toHaveLength(5);
  });
});
