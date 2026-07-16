import { describe, expect, it } from "vitest";

import { formatAmount, formatMoney } from "@/lib/money-ui";

/**
 * The point of this module is that output does NOT depend on the runtime locale:
 * these views are server-rendered and then hydrated in the browser, so a value
 * formatted with the runtime default would differ between the two renders and
 * trip a hydration mismatch.
 */
describe("formatAmount", () => {
  it("groups thousands and caps at 2 fraction digits", () => {
    expect(formatAmount(1234.56)).toBe("1,234.56");
    expect(formatAmount(1234)).toBe("1,234");
    expect(formatAmount(0)).toBe("0");
  });

  it("rounds beyond 2 decimals rather than printing a third", () => {
    // Bare toLocaleString() allows 3 fraction digits — money must not.
    expect(formatAmount(1234.5678)).toBe("1,234.57");
    expect(formatAmount(0.005)).toBe("0.01");
  });

  it("handles negatives and large values", () => {
    expect(formatAmount(-1234.5)).toBe("-1,234.5");
    expect(formatAmount(1234567.89)).toBe("1,234,567.89");
  });
});

describe("formatMoney", () => {
  it("renders CODE + amount, defaulting to USD", () => {
    expect(formatMoney(1234.56)).toBe("USD 1,234.56");
    expect(formatMoney(1234.56, "EUR")).toBe("EUR 1,234.56");
  });

  it("treats a nullish amount as zero (the behaviour it replaced)", () => {
    expect(formatMoney(undefined)).toBe("USD 0");
  });

  it("surfaces NaN instead of hiding it behind a plausible zero", () => {
    // A NaN reaching a money field is a data bug worth seeing.
    expect(formatMoney(NaN)).toBe("USD NaN");
  });

  // Pins the exact output contract. en-US grouping is "1,234.56"; a runtime-locale
  // implementation would render "1 234,56" under fr-FR and "1.234,56" under de-DE,
  // so this assertion is what fails if the pinned locale is ever dropped.
  it("uses en-US grouping regardless of where it runs", () => {
    expect(formatMoney(1234.56)).toBe("USD 1,234.56");
    expect(formatAmount(1234567.5)).toBe("1,234,567.5");
  });
});
