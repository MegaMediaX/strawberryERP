import { describe, expect, it } from "vitest";

import { formatRole, getTimezoneLabel } from "@/lib/sales/profile-data";

describe("getTimezoneLabel (spec §22)", () => {
  it("maps known countries to their timezone", () => {
    expect(getTimezoneLabel(["Lebanon"])).toBe("Asia/Beirut");
    expect(getTimezoneLabel(["Cyprus"])).toBe("Asia/Nicosia");
    expect(getTimezoneLabel(["Jordan"])).toBe("Asia/Amman");
    expect(getTimezoneLabel(["Syria"])).toBe("Asia/Damascus");
  });
  it("uses the first known country and defaults when none match", () => {
    expect(getTimezoneLabel(["Atlantis", "Jordan"])).toBe("Asia/Amman");
    expect(getTimezoneLabel([])).toBe("Asia/Beirut");
    expect(getTimezoneLabel(["Atlantis"])).toBe("Asia/Beirut");
  });
});

describe("formatRole", () => {
  it("returns the role label", () => {
    expect(formatRole("Sales Team User")).toBe("Sales Team User");
  });
});
