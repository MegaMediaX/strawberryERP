import { describe, expect, it } from "vitest";

import {
  buildSlot,
  generateSlotCatalog,
  groupSlotsByLetter,
  isPlaceableSlotLabel,
  isValidSlotLabel,
  parseSlot,
} from "@/lib/admin/slots";

describe("isPlaceableSlotLabel", () => {
  it("accepts the real venue catalog, incl. multi-letter + hyphenated LB labels", () => {
    for (const ok of ["A1", "G4", "M12", "LB5-1", "LB6-2", "AA1"]) {
      expect(isPlaceableSlotLabel(ok)).toBe(true);
    }
  });
  it("rejects malformed labels", () => {
    // "A" is intentionally NOT here: broadening to admit named features ("Island")
    // also admits a bare letter, which is harmless for a Super-Admin-authored label.
    for (const bad of ["", "1A", "-1", "A-", "A1-", "LB5-"]) {
      expect(isPlaceableSlotLabel(bad)).toBe(false);
    }
  });
  it("accepts named-feature labels like Island", () => {
    expect(isPlaceableSlotLabel("Island")).toBe(true);
    expect(isPlaceableSlotLabel("island")).toBe(true); // case-insensitive
  });
  it("rejects prototype-chain keys (security boundary)", () => {
    for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(isPlaceableSlotLabel(bad)).toBe(false);
    }
  });
  it("is the gate that unbricks LB booths that parseSlot's strict grammar rejects", () => {
    // Regression: LB5-1 must be placeable even though parseSlot returns null for it.
    expect(parseSlot("LB5-1")).toBeNull();
    expect(isPlaceableSlotLabel("LB5-1")).toBe(true);
  });
});

describe("generateSlotCatalog", () => {
  it("defaults to 6 per letter → 156 slots, A1 first, Z6 last", () => {
    const cat = generateSlotCatalog();
    expect(cat).toHaveLength(26 * 6);
    expect(cat[0]).toBe("A1");
    expect(cat[5]).toBe("A6");
    expect(cat[6]).toBe("B1");
    expect(cat.at(-1)).toBe("Z6");
  });
  it("honors a custom count + clamps to [1,99]", () => {
    expect(generateSlotCatalog(3)).toHaveLength(78);
    expect(generateSlotCatalog(0)).toHaveLength(26); // clamped to 1
  });
});

describe("parseSlot / buildSlot", () => {
  it("parses valid labels (case-insensitive)", () => {
    expect(parseSlot("a12")).toEqual({ letter: "A", number: 12 });
    expect(parseSlot(" B3 ")).toEqual({ letter: "B", number: 3 });
  });
  it("rejects garbage", () => {
    expect(parseSlot("AA1")).toBeNull();
    expect(parseSlot("A0")).toBeNull();
    expect(parseSlot("1A")).toBeNull();
    expect(parseSlot("")).toBeNull();
  });
  it("buildSlot round-trips", () => {
    expect(buildSlot("c", 4)).toBe("C4");
  });
});

describe("isValidSlotLabel", () => {
  it("checks range against slotsPerLetter", () => {
    expect(isValidSlotLabel("A6", 6)).toBe(true);
    expect(isValidSlotLabel("A7", 6)).toBe(false);
    expect(isValidSlotLabel("nope", 6)).toBe(false);
  });
});

describe("groupSlotsByLetter", () => {
  it("groups + sorts by letter then number", () => {
    const grouped = groupSlotsByLetter(["B2", "A3", "A1", "B1"]);
    expect(grouped).toEqual([
      { letter: "A", slots: ["A1", "A3"] },
      { letter: "B", slots: ["B1", "B2"] },
    ]);
  });
});
