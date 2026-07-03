import { describe, expect, it } from "vitest";

import { checkDialPolicy, classifyLine, DIAL_POLICY } from "@/lib/telephony/dial-policy";

describe("classifyLine (Lebanon numbering)", () => {
  it("classifies landlines (area codes 1, 4–9) — incl. +961, national, and 07 vs 70", () => {
    expect(classifyLine("+961 1 350 000")).toBe("landline"); // Beirut
    expect(classifyLine("01 350 000")).toBe("landline");     // national trunk 0
    expect(classifyLine("+961 6 400 000")).toBe("landline"); // North
    expect(classifyLine("07 740 000")).toBe("landline");     // South 07 — NOT mobile 70
  });

  it("classifies mobiles (3, 70/71/76/78/79, 81)", () => {
    expect(classifyLine("+961 70 144 221")).toBe("mobile");
    expect(classifyLine("03 123 456")).toBe("mobile");
    expect(classifyLine("+961 71 000 000")).toBe("mobile");
    expect(classifyLine("81 555 555")).toBe("mobile");
  });

  it("returns unknown for an unconfigured international number", () => {
    expect(classifyLine("+1 202 555 0100")).toBe("unknown");
  });
});

describe("checkDialPolicy (Lebanon = landline-only by default)", () => {
  it("allows a Lebanese landline", () => {
    const d = checkDialPolicy("01 350 000");
    expect(d).toMatchObject({ ok: true, country: "Lebanon", lineType: "landline" });
  });

  it("blocks a Lebanese mobile with a clear reason naming both line types", () => {
    const d = checkDialPolicy("+961 70 144 221");
    expect(d.ok).toBe(false);
    expect(d.lineType).toBe("mobile");
    expect(d.reason).toMatch(/mobile/i);
    expect(d.reason).toMatch(/landline/i);
  });

  it("blocks an unconfigured international destination", () => {
    const d = checkDialPolicy("+1 202 555 0100");
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/international|not enabled|configured/i);
  });
});

describe("modularity — mode is per-country and swappable", () => {
  it("mode 'auto' allows both mobile and landline", () => {
    const original = DIAL_POLICY[0].mode;
    DIAL_POLICY[0].mode = "auto";
    try {
      expect(checkDialPolicy("+961 70 144 221").ok).toBe(true); // mobile
      expect(checkDialPolicy("01 350 000").ok).toBe(true);       // landline
    } finally {
      DIAL_POLICY[0].mode = original;
    }
  });

  it("mode 'mobile' allows mobiles and blocks landlines", () => {
    const original = DIAL_POLICY[0].mode;
    DIAL_POLICY[0].mode = "mobile";
    try {
      expect(checkDialPolicy("+961 70 144 221").ok).toBe(true);
      const landline = checkDialPolicy("01 350 000");
      expect(landline.ok).toBe(false);
      expect(landline.reason).toMatch(/landline/i);
    } finally {
      DIAL_POLICY[0].mode = original;
    }
  });
});
