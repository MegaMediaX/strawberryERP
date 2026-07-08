import { describe, expect, it } from "vitest";

import { isBlockedPhone } from "@/lib/telephony/call-record";
import { toLocalDialNumber } from "@/lib/telephony/local-dial";

describe("toLocalDialNumber (Lebanon FXO local format)", () => {
  it("converts E.164 +961 mobiles to trunk-0 local format", () => {
    expect(toLocalDialNumber("+961 70 144 221")).toBe("070144221");
    expect(toLocalDialNumber("+96170144221")).toBe("070144221");
  });

  it("converts E.164 +961 landlines to trunk-0 local format (stored trunk 0 not doubled)", () => {
    expect(toLocalDialNumber("+961 5 941 119")).toBe("05941119");
    expect(toLocalDialNumber("+961 05 941 119")).toBe("05941119");
  });

  it("strips a bare 961 country prefix (no +)", () => {
    expect(toLocalDialNumber("96105941119")).toBe("05941119");
    expect(toLocalDialNumber("96170144221")).toBe("070144221");
  });

  it("strips a 00961 international prefix", () => {
    expect(toLocalDialNumber("00961 70 144 221")).toBe("070144221");
  });

  it("leaves 0-leading local numbers unchanged", () => {
    expect(toLocalDialNumber("05941119")).toBe("05941119");
    expect(toLocalDialNumber("05 941 119")).toBe("05941119");
    expect(toLocalDialNumber("03 123 456")).toBe("03123456");
  });

  it("adds the trunk 0 to a local number stored without it", () => {
    expect(toLocalDialNumber("70 144 221")).toBe("070144221");
    expect(toLocalDialNumber("81555555")).toBe("081555555");
  });

  it("does NOT mistake a 7-digit area-9 landline starting with 961 for a country code", () => {
    // NSN "9614941" = area 9, subscriber 614941 — local, not +961 4941.
    expect(toLocalDialNumber("9614941")).toBe("09614941");
  });

  it("leaves foreign international numbers as raw digits (no trunk 0)", () => {
    expect(toLocalDialNumber("+1 202 555 0100")).toBe("12025550100");
    expect(toLocalDialNumber("+972 50 123 4567")).toBe("972501234567");
  });

  it("returns empty string for empty or non-numeric input", () => {
    expect(toLocalDialNumber("")).toBe("");
    expect(toLocalDialNumber("no digits")).toBe("");
  });

  it("returns empty string for a bare country code with no subscriber number", () => {
    // Placeholder leads sometimes store just "+961"; a lone "0" must NOT look
    // dialable to the caller (the component treats "" as "no dialable number").
    expect(toLocalDialNumber("+961")).toBe("");
    expect(toLocalDialNumber("00961")).toBe("");
  });

  it("does not interfere with the isBlockedPhone guard on the raw number", () => {
    // The component checks isBlockedPhone(number) BEFORE normalizing; blocked
    // +972 numbers must still be caught on the raw value.
    expect(isBlockedPhone("+972 50 123 4567")).toBe(true);
    expect(isBlockedPhone("+961 70 144 221")).toBe(false);
  });
});
